import { NextResponse, type NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';
import { createSessionsService } from '@/features/sessions/sessions.service';
import { createPoolService } from '@/features/pool/pool.service';
import { AgentCallbackSchema } from '@/features/sessions/sessions.schema';

export async function POST(request: NextRequest) {
  const logger = getLogger();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = AgentCallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const sessionsService = createSessionsService();
    await sessionsService.handleAgentCallback(parsed.data);

    // Schedule container destruction (30s delay for log collection)
    const poolService = createPoolService();
    setTimeout(async () => {
      try {
        await poolService.reconcilePool();
      } catch (e) {
        logger.error({ error: e }, 'Post-callback reconciliation failed');
      }
    }, 30_000);

    logger.info(
      { sessionId: parsed.data.session_id },
      'Agent callback processed',
    );

    return NextResponse.json({ received: true });
  } catch (e) {
    logger.error({ error: e }, 'Failed to process agent callback');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
