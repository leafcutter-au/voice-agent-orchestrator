import 'server-only';

import { docker } from '@/lib/docker/client';
import { getLogger } from '@/lib/logger';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createPoolApi } from './pool.api';

const POOL_CONFIG = {
  MIN_WARM: Number(process.env.POOL_MIN_WARM ?? 2),
  WARM_RATIO: Number(process.env.POOL_WARM_RATIO ?? 0.3),
  BUFFER: Number(process.env.POOL_BUFFER ?? 1),
  MAX_IDLE_MINS: Number(process.env.POOL_MAX_IDLE_MINS ?? 30),
  IMAGE: process.env.POOL_IMAGE ?? 'paia-local-audio:latest',
  NETWORK: process.env.POOL_NETWORK ?? 'paia-network',
  AGENT_PORT: 8888,
  HEALTH_TIMEOUT_SECS: 90,
  ENV_FILE: process.env.POOL_ENV_FILE ?? '/etc/paia/agent.env',
};

export function createPoolService() {
  const client = createServiceRoleClient();
  const api = createPoolApi(client);
  return new PoolService(api);
}

interface AssignPayload {
  sessionId: string;
  meetingUrl: string;
  botName: string;
  interviewConfig: Record<string, unknown>;
  callbackUrl: string;
}

class PoolService {
  private readonly namespace = 'pool-service';

  constructor(private readonly api: typeof createPoolApi extends (...args: never[]) => infer R ? R : never) {}

  async spawnAgent(): Promise<string> {
    const logger = getLogger();
    logger.info({ namespace: this.namespace }, 'Spawning new agent container');

    // Read env file for agent secrets
    let envVars: string[] = ['PAIA_WARM_POOL=1', 'PAIA_DOCKER=1'];
    try {
      const fs = await import('fs');
      if (fs.existsSync(POOL_CONFIG.ENV_FILE)) {
        const envContent = fs.readFileSync(POOL_CONFIG.ENV_FILE, 'utf-8');
        const fileVars = envContent
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('#'));
        envVars = [...envVars, ...fileVars];
      }
    } catch {
      logger.warn({ namespace: this.namespace }, 'Could not read agent env file');
    }

    const container = await docker.createContainer({
      Image: POOL_CONFIG.IMAGE,
      Env: envVars,
      ExposedPorts: { [`${POOL_CONFIG.AGENT_PORT}/tcp`]: {} },
      HostConfig: {
        NetworkMode: POOL_CONFIG.NETWORK,
        ShmSize: 2 * 1024 * 1024 * 1024, // 2GB for Chrome
      },
    });

    await container.start();
    const info = await container.inspect();
    const ip =
      info.NetworkSettings?.Networks?.[POOL_CONFIG.NETWORK]?.IPAddress ?? null;

    const agent = await this.api.insertAgent({
      container_id: container.id,
      status: 'starting',
      internal_ip: ip,
    });

    // Poll health until warm
    const agentId = agent.id;
    const start = Date.now();
    const healthUrl = `http://${ip}:${POOL_CONFIG.AGENT_PORT}/health`;

    while ((Date.now() - start) / 1000 < POOL_CONFIG.HEALTH_TIMEOUT_SECS) {
      try {
        const resp = await fetch(healthUrl, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json();
        if (data.status === 'warm') {
          await this.api.updateAgent(agentId, {
            status: 'warm',
            last_health_check: new Date().toISOString(),
          });
          logger.info(
            { namespace: this.namespace, agentId, containerId: container.id },
            'Agent is warm',
          );
          return agentId;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Timeout — mark failed and clean up
    logger.error(
      { namespace: this.namespace, agentId },
      'Agent failed to become warm',
    );
    await this.api.updateAgent(agentId, {
      status: 'failed',
      error_message: 'Timed out waiting for warm status',
    });
    await this.destroyContainer(container.id);
    throw new Error(`Agent ${agentId} failed to become warm`);
  }

  async assignAgent(payload: AssignPayload) {
    const logger = getLogger();
    const ctx = { namespace: this.namespace, sessionId: payload.sessionId };

    const agent = await this.api.getOldestWarmAgent();
    if (!agent) {
      logger.warn(ctx, 'No warm agents available');
      return null;
    }

    logger.info(
      { ...ctx, agentId: agent.id },
      'Assigning agent to session',
    );

    // POST /assign to agent container
    const assignUrl = `http://${agent.internal_ip}:${POOL_CONFIG.AGENT_PORT}/assign`;
    const resp = await fetch(assignUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_url: payload.meetingUrl,
        bot_name: payload.botName,
        interview_config: payload.interviewConfig,
        callback_url: payload.callbackUrl,
        session_id: payload.sessionId,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      logger.error(
        { ...ctx, agentId: agent.id, status: resp.status, detail },
        'Agent assignment failed',
      );
      throw new Error(`Agent assignment failed: ${resp.status}`);
    }

    await this.api.updateAgent(agent.id, {
      status: 'active',
      session_id: payload.sessionId,
      assigned_at: new Date().toISOString(),
    });

    logger.info({ ...ctx, agentId: agent.id }, 'Agent assigned successfully');

    // Trigger reconciliation (async, don't await)
    this.reconcilePool().catch((e) =>
      logger.error({ namespace: this.namespace, error: e }, 'Reconciliation failed'),
    );

    return agent.id;
  }

  async reconcilePool() {
    const logger = getLogger();
    const ctx = { namespace: this.namespace };

    const agents = await this.api.getAgentsByStatus([
      'starting',
      'warm',
      'active',
      'draining',
    ]);

    const active = agents.filter((a) => a.status === 'active').length;
    const warm = agents.filter((a) => a.status === 'warm').length;
    const desired = Math.max(
      POOL_CONFIG.MIN_WARM,
      Math.ceil(active * POOL_CONFIG.WARM_RATIO),
    );

    logger.info(
      { ...ctx, active, warm, desired },
      'Reconciling pool',
    );

    // Scale up
    if (warm < desired) {
      const toSpawn = desired - warm;
      logger.info({ ...ctx, toSpawn }, 'Scaling up');
      const promises = Array.from({ length: toSpawn }, () =>
        this.spawnAgent().catch((e) =>
          logger.error({ ...ctx, error: e }, 'Failed to spawn agent'),
        ),
      );
      await Promise.allSettled(promises);
    }

    // Scale down excess
    if (warm > desired + POOL_CONFIG.BUFFER) {
      const toDestroy = warm - desired - POOL_CONFIG.BUFFER;
      const warmAgents = agents
        .filter((a) => a.status === 'warm')
        .sort(
          (a, b) =>
            new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
        );

      for (let i = 0; i < Math.min(toDestroy, warmAgents.length); i++) {
        await this.destroyAgent(warmAgents[i]!.id);
      }
    }

    // Replace stale warm agents
    const maxIdleMs = POOL_CONFIG.MAX_IDLE_MINS * 60 * 1000;
    const staleAgents = agents.filter(
      (a) =>
        a.status === 'warm' &&
        Date.now() - new Date(a.started_at).getTime() > maxIdleMs,
    );
    for (const agent of staleAgents) {
      logger.info(
        { ...ctx, agentId: agent.id },
        'Replacing stale warm agent',
      );
      await this.destroyAgent(agent.id);
      await this.spawnAgent().catch((e) =>
        logger.error({ ...ctx, error: e }, 'Failed to replace stale agent'),
      );
    }
  }

  async healthCheck() {
    const logger = getLogger();
    const agents = await this.api.getAgentsByStatus([
      'starting',
      'warm',
      'active',
    ]);

    for (const agent of agents) {
      if (!agent.internal_ip) continue;

      try {
        const resp = await fetch(
          `http://${agent.internal_ip}:${POOL_CONFIG.AGENT_PORT}/health`,
          { signal: AbortSignal.timeout(5000) },
        );
        const data = await resp.json();

        // Sync status if agent reports differently
        if (data.status === 'active' && agent.status === 'warm') {
          await this.api.updateAgent(agent.id, { status: 'active' });
        } else if (data.status === 'draining') {
          await this.api.updateAgent(agent.id, { status: 'draining' });
          // Schedule destruction
          setTimeout(() => this.destroyAgent(agent.id).catch(() => {}), 30000);
        }

        await this.api.updateAgent(agent.id, {
          last_health_check: new Date().toISOString(),
        });
      } catch {
        // Check consecutive failures
        const lastCheck = agent.last_health_check
          ? new Date(agent.last_health_check).getTime()
          : Date.now();
        const missedMs = Date.now() - lastCheck;

        // 3 consecutive misses (30s at 10s interval)
        if (missedMs > 30000) {
          logger.error(
            { namespace: this.namespace, agentId: agent.id },
            'Agent unresponsive — marking failed',
          );
          await this.api.updateAgent(agent.id, {
            status: 'failed',
            error_message: 'Health check timeout',
          });
          await this.destroyContainer(agent.container_id);
        }
      }
    }
  }

  async destroyAgent(agentId: string) {
    const logger = getLogger();
    const agent = await this.api.getAgentById(agentId);
    if (!agent) return;

    logger.info(
      { namespace: this.namespace, agentId, containerId: agent.container_id },
      'Destroying agent',
    );

    await this.destroyContainer(agent.container_id);
    await this.api.deleteAgent(agentId);
  }

  async scaleUp(count: number) {
    const promises = Array.from({ length: count }, () => this.spawnAgent());
    return Promise.allSettled(promises);
  }

  async scaleDown(count: number) {
    const warmAgents = await this.api.getAgentsByStatus(['warm']);
    const sorted = warmAgents.sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
    const toDestroy = sorted.slice(0, count);
    for (const agent of toDestroy) {
      await this.destroyAgent(agent.id);
    }
    return toDestroy.length;
  }

  async getStats() {
    return this.api.getStatusCounts();
  }

  async getAllAgents() {
    return this.api.getAllAgents();
  }

  private async destroyContainer(containerId: string) {
    try {
      const container = docker.getContainer(containerId);
      await container.stop({ t: 5 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});
    } catch (e) {
      getLogger().warn(
        { namespace: this.namespace, containerId, error: e },
        'Container cleanup failed',
      );
    }
  }
}
