import { NextResponse, type NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';
import { createSessionsService } from '@/features/sessions/sessions.service';
import { createPoolService } from '@/features/pool/pool.service';
import { CreateSessionSchema } from '@/features/sessions/sessions.schema';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${apiKey}`;
}

export async function POST(request: NextRequest) {
  const logger = getLogger();

  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const sessionsService = createSessionsService();
    const session = await sessionsService.createSession(parsed.data);

    // Assign a warm agent
    const poolService = createPoolService();
    // Use Docker network hostname so agent containers can reach us
    const internalOrigin = process.env.INTERNAL_ORIGIN ?? request.nextUrl.origin;
    const callbackUrl = `${internalOrigin}/api/webhooks/voice-agent`;

    const agentId = await poolService.assignAgent({
      sessionId: session.id,
      meetingUrl: parsed.data.meeting_url,
      botName: 'PAIA',
      interviewConfig: parsed.data.interview_config,
      callbackUrl,
    });

    if (!agentId) {
      return NextResponse.json(
        { error: 'no_warm_agents', session_id: session.id },
        { status: 503 },
      );
    }

    await sessionsService.markSessionConnecting(session.id, agentId);

    logger.info(
      { sessionId: session.id, agentId },
      'Session created and agent assigned',
    );

    return NextResponse.json({
      session_id: session.id,
      status: 'connecting',
    });
  } catch (e) {
    logger.error({ error: e }, 'Failed to create session');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionsService = createSessionsService();
    const sessions = await sessionsService.getRecentSessions(50);
    return NextResponse.json({ sessions });
  } catch (e) {
    getLogger().error({ error: e }, 'Failed to list sessions');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
