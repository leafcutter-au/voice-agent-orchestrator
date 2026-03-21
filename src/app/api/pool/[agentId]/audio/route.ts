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
    const audio = await service.getAudioHealth(agentId);
    return NextResponse.json(audio);
  } catch (e) {
    getLogger().error({ error: e, agentId }, 'Failed to get audio health');
    return NextResponse.json({ error: 'Failed to get audio health' }, { status: 500 });
  }
}
