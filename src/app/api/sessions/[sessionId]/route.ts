import { NextResponse, type NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';
import { createSessionsService } from '@/features/sessions/sessions.service';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${apiKey}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId } = await params;
    const service = createSessionsService();
    const session = await service.getSession(sessionId);
    return NextResponse.json(session);
  } catch (e) {
    getLogger().error({ error: e }, 'Failed to get session');
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }
}
