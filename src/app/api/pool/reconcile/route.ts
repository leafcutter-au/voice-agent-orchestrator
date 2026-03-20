import { NextResponse, type NextRequest } from 'next/server';
import { getLogger } from '@/lib/logger';
import { createPoolService } from '@/features/pool/pool.service';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${apiKey}`;
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const service = createPoolService();
    await service.reconcilePool();
    return NextResponse.json({ success: true });
  } catch (e) {
    getLogger().error({ error: e }, 'Manual reconciliation failed');
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 },
    );
  }
}
