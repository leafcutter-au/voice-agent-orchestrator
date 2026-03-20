import { NextResponse, type NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';
import { createPoolService } from '@/features/pool/pool.service';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${apiKey}`;
}

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const service = createPoolService();
    const [stats, agents] = await Promise.all([
      service.getStats(),
      service.getAllAgents(),
    ]);
    return NextResponse.json({ stats, agents });
  } catch (e) {
    getLogger().error({ error: e }, 'Failed to get pool stats');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
