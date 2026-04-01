import 'server-only';

import { getLogger } from '@/lib/logger';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createSessionsApi } from './sessions.api';
import { createPoolApi } from '@/features/pool/pool.api';
import type { Database } from '@/lib/supabase/database.types';
import type { CreateSessionInput, AgentCallbackInput } from './sessions.schema';

type Json = Database['public']['Tables']['voice_sessions']['Row']['results'];

export function createSessionsService() {
  const client = createServiceRoleClient();
  return new SessionsService(
    createSessionsApi(client),
    createPoolApi(client),
  );
}

class SessionsService {
  private readonly namespace = 'sessions-service';

  constructor(
    private readonly api: ReturnType<typeof createSessionsApi>,
    private readonly poolApi: ReturnType<typeof createPoolApi>,
  ) {}

  async createSession(input: CreateSessionInput) {
    const logger = getLogger();
    const ctx = { namespace: this.namespace };

    logger.info(ctx, 'Creating new session');

    const session = await this.api.createSession({
      meeting_url: input.meeting_url,
      interview_config: input.interview_config as unknown as Database['public']['Tables']['voice_sessions']['Insert']['interview_config'],
      stakeholder_name: input.interview_config.stakeholder_context.name,
      stakeholder_role: input.interview_config.stakeholder_context.role,
      callback_url: input.callback_url,
      status: 'pending',
    });

    await this.api.insertEvent({
      session_id: session.id,
      event_type: 'session_created',
    });

    logger.info(
      { ...ctx, sessionId: session.id },
      'Session created',
    );

    return session;
  }

  async handleAgentCallback(input: AgentCallbackInput) {
    const logger = getLogger();
    const ctx = { namespace: this.namespace, sessionId: input.session_id };

    logger.info(ctx, `Agent callback received: ${input.status}`);

    const now = new Date().toISOString();
    const session = await this.api.getSessionById(input.session_id);

    const durationSeconds = session.started_at
      ? Math.round(
          (new Date(now).getTime() - new Date(session.started_at).getTime()) /
            1000,
        )
      : null;

    await this.api.updateSession(input.session_id, {
      status: input.status === 'completed' ? 'completed' : 'failed',
      ended_at: now,
      duration_seconds: durationSeconds,
      results: (input.results as Json) ?? null,
    });

    await this.api.insertEvent({
      session_id: input.session_id,
      event_type:
        input.status === 'completed'
          ? 'interview_completed'
          : 'interview_failed',
      event_data: {
        ...(input.error && { error: input.error }),
        duration_seconds: durationSeconds,
      },
    });

    // Update pool agent to draining
    if (session.pool_agent_id) {
      await this.poolApi.updateAgent(session.pool_agent_id, {
        status: 'draining',
      });
    }

    // Forward results to Discovery callback if configured
    if (session.callback_url) {
      try {
        await fetch(session.callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: input.session_id,
            status: input.status,
            ...(input.results && { results: input.results }),
            ...(input.error && { error: input.error }),
          }),
          signal: AbortSignal.timeout(10000),
        });
        logger.info(ctx, 'Results forwarded to callback URL');
      } catch (e) {
        logger.error({ ...ctx, error: e }, 'Failed to forward results');
      }
    }

    logger.info(ctx, 'Agent callback processed');
  }

  async markSessionConnecting(sessionId: string, poolAgentId: string) {
    await this.api.updateSession(sessionId, {
      status: 'connecting',
      pool_agent_id: poolAgentId,
      started_at: new Date().toISOString(),
    });
    await this.api.insertEvent({
      session_id: sessionId,
      event_type: 'agent_assigned',
      event_data: { pool_agent_id: poolAgentId },
    });
  }

  async cancelSession(sessionId: string) {
    const session = await this.api.getSessionById(sessionId);
    if (session.status !== 'pending') {
      throw new Error(`Cannot cancel session in status: ${session.status}`);
    }
    await this.api.updateSession(sessionId, {
      status: 'cancelled',
      ended_at: new Date().toISOString(),
    });
    await this.api.insertEvent({
      session_id: sessionId,
      event_type: 'session_cancelled',
    });
  }

  async stopSession(sessionId: string) {
    const logger = getLogger();
    const session = await this.api.getSessionById(sessionId);

    if (!session.pool_agent_id) {
      throw new Error('No agent assigned to this session');
    }

    const agent = await this.poolApi.getAgentById(session.pool_agent_id);
    if (!agent?.internal_ip) {
      throw new Error('Agent not reachable');
    }

    const resp = await fetch(
      `http://${agent.internal_ip}:8888/stop`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!resp.ok) {
      throw new Error(`Stop request failed: ${resp.status}`);
    }

    await this.api.insertEvent({
      session_id: sessionId,
      event_type: 'stop_requested',
    });

    logger.info({ namespace: this.namespace, sessionId }, 'Stop requested');
  }

  async deleteSession(sessionId: string) {
    const logger = getLogger();
    logger.info({ namespace: this.namespace, sessionId }, 'Deleting session');
    await this.api.deleteSession(sessionId);
  }

  async getSession(id: string) {
    return this.api.getSessionById(id);
  }

  async getRecentSessions(limit = 20) {
    return this.api.getRecentSessions(limit);
  }

  async getSessionsPaginated(page: number, pageSize: number, status?: string) {
    return this.api.getSessionsPaginated(page, pageSize, status);
  }

  async getSessionEvents(sessionId: string) {
    return this.api.getEventsBySession(sessionId);
  }
}
