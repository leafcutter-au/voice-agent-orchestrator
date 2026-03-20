export const dynamic = 'force-dynamic';

import { loadDashboardData } from '@/features/dashboard/dashboard.loader';
import { StatsCards } from '@/features/dashboard/components/stats-cards';
import { PoolStatusBar } from '@/features/dashboard/components/pool-status-bar';
import { RecentSessions } from '@/features/dashboard/components/recent-sessions';

export default async function DashboardPage() {
  const { poolCounts, recentSessions } = await loadDashboardData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <StatsCards poolCounts={poolCounts} recentSessions={recentSessions} />
      <PoolStatusBar counts={poolCounts} />
      <RecentSessions sessions={recentSessions} />
    </div>
  );
}
