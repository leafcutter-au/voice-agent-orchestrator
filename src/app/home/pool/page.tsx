export const dynamic = 'force-dynamic';

import { loadPoolData } from '@/features/pool/pool.loader';
import { PoolOverview } from '@/features/pool/components/pool-overview';

export default async function PoolPage() {
  const { agents, counts } = await loadPoolData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Pool</h1>
      <PoolOverview initialAgents={agents} initialCounts={counts} />
    </div>
  );
}
