'use client';

import { Activity, Server, Gauge, Clock } from 'lucide-react';
import { usePoolData } from '@/hooks/use-pool-data';
import { useRecentSessions } from '@/hooks/use-sessions-data';
import { useRealtimeTable } from '@/hooks/use-realtime';
import type { Database } from '@/lib/supabase/database.types';

type Session = Database['public']['Tables']['voice_sessions']['Row'];

interface StatsCardsProps {
  initialPoolCounts: Record<string, number>;
  initialSessions: Session[];
}

const BUSY_STATUSES = ['assigned', 'joining', 'in_meeting', 'interviewing'];

export function StatsCards({
  initialPoolCounts,
  initialSessions,
}: StatsCardsProps) {
  const { data: poolData } = usePoolData({
    agents: [],
    counts: initialPoolCounts,
  });
  const { data: sessions } = useRecentSessions(initialSessions);
  useRealtimeTable('pool_agents', ['pool-agents']);
  useRealtimeTable('voice_sessions', ['dashboard-sessions']);

  const poolCounts = poolData?.counts ?? initialPoolCounts;
  const recentSessions = sessions ?? initialSessions;

  const activeSessions = recentSessions.filter(
    (s) => s.status === 'active' || s.status === 'connecting',
  ).length;
  const warmAgents = poolCounts['warm'] ?? 0;
  const total = Object.values(poolCounts).reduce((sum, n) => sum + n, 0);
  const busyCount = BUSY_STATUSES.reduce(
    (sum, s) => sum + (poolCounts[s] ?? 0),
    0,
  );
  const utilization =
    total > 0 ? Math.round((busyCount / total) * 100) : 0;

  const completedSessions = recentSessions.filter(
    (s) => s.status === 'completed' && s.duration_seconds,
  );
  const avgDuration =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce(
            (sum, s) => sum + (s.duration_seconds ?? 0),
            0,
          ) /
            completedSessions.length /
            60,
        )
      : 0;

  const cards = [
    { label: 'Active Sessions', value: activeSessions, icon: Activity },
    { label: 'Warm Agents', value: warmAgents, icon: Server },
    { label: 'Pool Utilization', value: `${utilization}%`, icon: Gauge },
    { label: 'Avg Duration', value: `${avgDuration}m`, icon: Clock },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="border-border rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">{card.label}</div>
            <card.icon className="text-muted-foreground h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
