'use client';

import { formatDistanceToNow } from 'date-fns';
import { AgentStatusBadge } from './agent-status-badge';
import { PoolControls } from './pool-controls';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { usePoolData } from '@/hooks/use-pool-data';
import type { Database } from '@/lib/supabase/database.types';

type PoolAgent = Database['public']['Tables']['pool_agents']['Row'];

interface PoolOverviewProps {
  initialAgents: PoolAgent[];
  initialCounts: Record<string, number>;
}

const statusGroups = [
  { key: 'warm', label: 'Warm', color: 'bg-green-500' },
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-400' },
  { key: 'joining', label: 'Joining', color: 'bg-blue-500' },
  { key: 'in_meeting', label: 'In Meeting', color: 'bg-indigo-500' },
  { key: 'interviewing', label: 'Interviewing', color: 'bg-purple-500' },
  { key: 'starting', label: 'Starting', color: 'bg-yellow-500' },
  { key: 'draining', label: 'Draining', color: 'bg-orange-500' },
  { key: 'failed', label: 'Failed', color: 'bg-red-500' },
] as const;

export function PoolOverview({ initialAgents, initialCounts }: PoolOverviewProps) {
  const { data } = usePoolData({
    agents: initialAgents,
    counts: initialCounts,
  });
  useRealtimeTable('pool_agents', ['pool-agents']);

  const agents = data?.agents ?? initialAgents;
  const counts = data?.counts ?? initialCounts;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const busyCount =
    (counts['assigned'] ?? 0) +
    (counts['joining'] ?? 0) +
    (counts['in_meeting'] ?? 0) +
    (counts['interviewing'] ?? 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="border-border rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Total</div>
          <div className="mt-1 text-2xl font-bold">{total}</div>
        </div>
        <div className="border-border rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Warm</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {counts['warm'] ?? 0}
          </div>
        </div>
        <div className="border-border rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Busy</div>
          <div className="mt-1 text-2xl font-bold text-purple-600">
            {busyCount}
          </div>
        </div>
        <div className="border-border rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Starting</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {counts['starting'] ?? 0}
          </div>
        </div>
        <div className="border-border rounded-lg border p-4">
          <div className="text-muted-foreground text-sm">Failed</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {counts['failed'] ?? 0}
          </div>
        </div>
      </div>

      {/* Pool status bar */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex h-4 overflow-hidden rounded-full">
            {statusGroups
              .filter((s) => (counts[s.key] ?? 0) > 0)
              .map((s) => (
                <div
                  key={s.key}
                  className={s.color}
                  style={{
                    width: `${((counts[s.key] ?? 0) / total) * 100}%`,
                  }}
                  title={`${s.label}: ${counts[s.key]}`}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            {statusGroups
              .filter((s) => (counts[s.key] ?? 0) > 0)
              .map((s) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${s.color}`} />
                  <span className="text-muted-foreground">
                    {s.label}: {counts[s.key]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <PoolControls />

      {/* Agent grid */}
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Agent</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">IP</th>
              <th className="px-4 py-2 text-left font-medium">Session</th>
              <th className="px-4 py-2 text-left font-medium">Uptime</th>
              <th className="px-4 py-2 text-left font-medium">Last Health</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <div className="text-sm font-medium">
                    {agent.container_name ?? agent.container_id.substring(0, 12)}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <AgentStatusBadge status={agent.status} />
                </td>
                <td className="px-4 py-2 text-xs">{agent.internal_ip ?? '-'}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  {agent.session_id?.substring(0, 8) ?? '-'}
                </td>
                <td className="text-muted-foreground px-4 py-2 text-xs">
                  {formatDistanceToNow(new Date(agent.started_at), {
                    addSuffix: false,
                  })}
                </td>
                <td className="text-muted-foreground px-4 py-2 text-xs">
                  {agent.last_health_check
                    ? formatDistanceToNow(new Date(agent.last_health_check), {
                        addSuffix: true,
                      })
                    : '-'}
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  No agents in pool
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
