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

    // Generate a short readable name: paia-agent-<4 hex chars>
    const shortId = Math.random().toString(16).slice(2, 6);
    const containerName = `paia-agent-${shortId}`;

    const container = await docker.createContainer({
      name: containerName,
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
      container_name: containerName,
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
      status: 'assigned',
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

    const busyStatuses = ['assigned', 'joining', 'in_meeting', 'interviewing'] as const;
    const agents = await this.api.getAgentsByStatus([
      'starting',
      'warm',
      ...busyStatuses,
      'draining',
    ]);

    const active = agents.filter((a) =>
      (busyStatuses as readonly string[]).includes(a.status),
    ).length;
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

    // Replace stale warm agents (disabled when MAX_IDLE_MINS <= 0)
    if (POOL_CONFIG.MAX_IDLE_MINS > 0) {
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
  }

  async healthCheck() {
    const logger = getLogger();
    const agents = await this.api.getAgentsByStatus([
      'starting',
      'warm',
      'assigned',
      'joining',
      'in_meeting',
      'interviewing',
    ]);

    for (const agent of agents) {
      if (!agent.internal_ip) continue;

      try {
        const resp = await fetch(
          `http://${agent.internal_ip}:${POOL_CONFIG.AGENT_PORT}/health`,
          { signal: AbortSignal.timeout(5000) },
        );
        const data = await resp.json();

        // Sync granular status from agent — the agent is the source of truth
        const agentStatus = data.status as string;
        const validStatuses = [
          'warm', 'assigned', 'joining', 'in_meeting', 'interviewing', 'draining',
        ];
        if (validStatuses.includes(agentStatus) && agentStatus !== agent.status) {
          await this.api.updateAgent(agent.id, {
            status: agentStatus as typeof agent.status,
          });

          if (agentStatus === 'draining') {
            setTimeout(() => this.destroyAgent(agent.id).catch(() => {}), 30000);
          }
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

    // Cancel any linked session that's still in progress
    if (agent.session_id) {
      try {
        await this.api.cancelSession(agent.session_id);
        await this.api.insertSessionEvent(agent.session_id, 'agent_destroyed');
      } catch (e) {
        logger.warn(
          { namespace: this.namespace, agentId, sessionId: agent.session_id, error: e },
          'Failed to cancel linked session',
        );
      }
    }

    // Delete DB record first so health checks stop targeting this agent,
    // then destroy the container. Prevents the race condition where
    // healthCheck() finds a DB record with status='warm' but the container
    // is already gone, and marks it as 'failed'.
    await this.api.deleteAgent(agentId);
    await this.destroyContainer(agent.container_id);
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

  async stopAgent(agentId: string) {
    const logger = getLogger();
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    if (!agent.internal_ip) throw new Error('Agent has no IP address');

    const stoppableStatuses = ['interviewing', 'in_meeting'];
    if (!stoppableStatuses.includes(agent.status)) {
      throw new Error(`Agent cannot be stopped in status: ${agent.status}`);
    }

    logger.info(
      { namespace: this.namespace, agentId },
      'Sending stop request to agent',
    );

    const resp = await fetch(
      `http://${agent.internal_ip}:${POOL_CONFIG.AGENT_PORT}/stop`,
      { method: 'POST', signal: AbortSignal.timeout(10000) },
    );

    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Stop request failed: ${resp.status} — ${detail}`);
    }

    if (agent.session_id) {
      await this.api.insertSessionEvent(agent.session_id, 'stop_requested');
    }
  }

  async getAgentWithSession(agentId: string) {
    return this.api.getAgentWithSession(agentId);
  }

  private async execInContainer(containerId: string, cmd: string[], env?: string[]): Promise<string> {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Env: env,
    });
    const stream = await exec.start({ Detach: false, Tty: false });

    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        // Docker multiplexed stream: 8-byte header per frame
        // header[0] = stream type (1=stdout, 2=stderr)
        // header[4..7] = payload size (big-endian uint32)
        let offset = 0;
        while (offset < chunk.length) {
          if (offset + 8 > chunk.length) break;
          const size = chunk.readUInt32BE(offset + 4);
          if (offset + 8 + size > chunk.length) {
            chunks.push(chunk.subarray(offset + 8));
            break;
          }
          chunks.push(chunk.subarray(offset + 8, offset + 8 + size));
          offset += 8 + size;
        }
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }

  async getPipecatLogs(agentId: string): Promise<string> {
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    return this.execInContainer(agent.container_id, [
      'sh', '-c', 'cat /pipecat/logs/pipecat_*.log 2>/dev/null | tail -500',
    ]);
  }

  async getLatencyData(agentId: string): Promise<Record<string, unknown>[]> {
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    const raw = await this.execInContainer(agent.container_id, [
      'sh', '-c', 'cat /pipecat/logs/latency_*.jsonl 2>/dev/null',
    ]);
    if (!raw.trim()) return [];
    return raw
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  async getInterviewResults(agentId: string): Promise<Record<string, unknown> | null> {
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    try {
      const raw = await this.execInContainer(agent.container_id, [
        'cat', '/pipecat/logs/interview_results.json',
      ]);
      if (!raw.trim()) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async getContainerStats(agentId: string) {
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    const container = docker.getContainer(agent.container_id);
    const stats = await container.stats({ stream: false }) as unknown as Record<string, unknown>;

    // Parse CPU
    const cpuStats = stats.cpu_stats as Record<string, unknown>;
    const preCpuStats = stats.precpu_stats as Record<string, unknown>;
    const cpuUsage = cpuStats.cpu_usage as Record<string, unknown>;
    const preCpuUsage = preCpuStats.cpu_usage as Record<string, unknown>;
    const cpuDelta = (cpuUsage.total_usage as number) - (preCpuUsage.total_usage as number);
    const systemDelta = (cpuStats.system_cpu_usage as number) - (preCpuStats.system_cpu_usage as number);
    const numCpus = ((cpuStats.cpu_usage as Record<string, unknown>)?.percpu_usage as unknown[])?.length ?? 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    // Parse Memory
    const memStats = stats.memory_stats as Record<string, number>;
    const memoryUsageMb = (memStats.usage ?? 0) / (1024 * 1024);
    const memoryLimitMb = (memStats.limit ?? 0) / (1024 * 1024);

    // Parse Network
    const networks = stats.networks as Record<string, Record<string, number>> | undefined;
    let rxBytes = 0;
    let txBytes = 0;
    if (networks) {
      for (const iface of Object.values(networks)) {
        rxBytes += iface.rx_bytes ?? 0;
        txBytes += iface.tx_bytes ?? 0;
      }
    }

    return {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_usage_mb: Math.round(memoryUsageMb),
      memory_limit_mb: Math.round(memoryLimitMb),
      network_rx_mb: Math.round((rxBytes / (1024 * 1024)) * 100) / 100,
      network_tx_mb: Math.round((txBytes / (1024 * 1024)) * 100) / 100,
    };
  }

  async getAudioHealth(agentId: string) {
    const agent = await this.api.getAgentById(agentId);
    if (!agent) throw new Error('Agent not found');

    const pulseEnv = [
      'PULSE_RUNTIME_PATH=/tmp/pulse',
      'XDG_RUNTIME_DIR=/tmp/pulse',
    ];

    // Check if PulseAudio is running
    const paCheck = await this.execInContainer(
      agent.container_id,
      ['sh', '-c', 'pulseaudio --check 2>/dev/null && echo "PA_OK" || echo "PA_DEAD"'],
      pulseEnv,
    );
    const paRunning = paCheck.includes('PA_OK');

    const safeExec = async (args: string[]) => {
      if (!paRunning) return '';
      try {
        const output = await this.execInContainer(agent.container_id, args, pulseEnv);
        if (output.includes('Connection refused') || output.includes('Connection failure')) {
          return '';
        }
        return output;
      } catch {
        return '';
      }
    };

    const [sinks, sources, sinkInputs, sourceOutputs] = await Promise.all([
      safeExec(['pactl', 'list', 'short', 'sinks']),
      safeExec(['pactl', 'list', 'short', 'sources']),
      safeExec(['pactl', 'list', 'short', 'sink-inputs']),
      safeExec(['pactl', 'list', 'short', 'source-outputs']),
    ]);

    const parseLines = (raw: string) => {
      if (!raw.trim()) return [];
      return raw.trim().split('\n').filter(Boolean).map((line) => {
        const parts = line.split('\t');
        return { id: parts[0], name: parts[1], module: parts[2], state: parts[parts.length - 1] };
      });
    };

    return {
      pulseaudio_running: paRunning,
      sinks: parseLines(sinks),
      sources: parseLines(sources),
      sink_inputs: parseLines(sinkInputs),
      source_outputs: parseLines(sourceOutputs),
    };
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
