'use client';

import { formatDistanceToNow } from 'date-fns';
import { AgentStatusBadge } from './agent-status-badge';
import { PoolControls } from './pool-controls';
import { useRealtimeTable } from '@/hooks/use-realtime';
import type { Database } from '@/lib/supabase/database.types';

type PoolAgent = Database['public']['Tables']['pool_agents']['Row'];

interface PoolOverviewProps {
  agents: PoolAgent[];
  counts: Record<string, number>;
}

export function PoolOverview({ agents, counts }: PoolOverviewProps) {
  useRealtimeTable('pool_agents', ['pool-agents']);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-4">
        {(['starting', 'warm', 'active', 'draining', 'failed'] as const).map(
          (status) => (
            <div key={status} className="border-border rounded-lg border p-4">
              <div className="text-muted-foreground text-sm capitalize">
                {status}
              </div>
              <div className="mt-1 text-2xl font-bold">{counts[status] ?? 0}</div>
            </div>
          ),
        )}
      </div>

      {/* Pool status bar */}
      {total > 0 && (
        <div className="flex h-4 overflow-hidden rounded-full">
          {(counts['warm'] ?? 0) > 0 && (
            <div
              className="bg-green-500"
              style={{ width: `${((counts['warm'] ?? 0) / total) * 100}%` }}
              title={`Warm: ${counts['warm']}`}
            />
          )}
          {(counts['active'] ?? 0) > 0 && (
            <div
              className="bg-blue-500"
              style={{ width: `${((counts['active'] ?? 0) / total) * 100}%` }}
              title={`Active: ${counts['active']}`}
            />
          )}
          {(counts['starting'] ?? 0) > 0 && (
            <div
              className="bg-yellow-500"
              style={{ width: `${((counts['starting'] ?? 0) / total) * 100}%` }}
              title={`Starting: ${counts['starting']}`}
            />
          )}
          {(counts['draining'] ?? 0) > 0 && (
            <div
              className="bg-orange-500"
              style={{ width: `${((counts['draining'] ?? 0) / total) * 100}%` }}
              title={`Draining: ${counts['draining']}`}
            />
          )}
          {(counts['failed'] ?? 0) > 0 && (
            <div
              className="bg-red-500"
              style={{ width: `${((counts['failed'] ?? 0) / total) * 100}%` }}
              title={`Failed: ${counts['failed']}`}
            />
          )}
        </div>
      )}

      <PoolControls />

      {/* Agent grid */}
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Container</th>
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
                <td className="px-4 py-2 font-mono text-xs">
                  {agent.container_id.substring(0, 12)}
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
