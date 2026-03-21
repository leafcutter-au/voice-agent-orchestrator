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
    const stats = await service.getContainerStats(agentId);
    return NextResponse.json(stats);
  } catch (e) {
    getLogger().error({ error: e, agentId }, 'Failed to get container stats');
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
