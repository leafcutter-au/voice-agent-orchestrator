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

  // Fire-and-forget — reconciliation spawns containers which can take minutes.
  // Return immediately so the caller isn't blocked.
  const service = createPoolService();
  service.reconcilePool().catch((e) =>
    getLogger().error({ error: e }, 'Manual reconciliation failed'),
  );
  return NextResponse.json({ success: true, message: 'Reconciliation triggered' });
}
