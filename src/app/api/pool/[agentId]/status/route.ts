import { NextResponse, type NextRequest } from 'next/server';
import { createPoolService } from '@/features/pool/pool.service';
import { getLogger } from '@/lib/logger';
import { validateRequest } from '../auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const authError = await validateRequest(request);
  if (authError) return authError;

  const { agentId } = await params;

  try {
    const service = createPoolService();
    const { agent } = await service.getAgentWithSession(agentId);

    if (!agent.internal_ip) {
      return NextResponse.json({ error: 'Agent has no IP' }, { status: 400 });
    }

    const resp = await fetch(`http://${agent.internal_ip}:8888/status`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    getLogger().error({ error: e, agentId }, 'Failed to get agent status');
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
