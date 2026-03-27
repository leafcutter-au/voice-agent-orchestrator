'use client';

import { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Square, Trash2 } from 'lucide-react';
import { AgentStatusBadge } from './agent-status-badge';
import { PoolControls } from './pool-controls';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { usePoolData } from '@/hooks/use-pool-data';
import { destroyAgentAction, stopAgentAction } from '../server-actions';
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, startBulkTransition] = useTransition();

  // Clear selection for agents that no longer exist
  const agentIds = new Set(agents.map((a) => a.id));
  const validSelected = new Set([...selected].filter((id) => agentIds.has(id)));
  if (validSelected.size !== selected.size && selected.size > 0) {
    setSelected(validSelected);
  }

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === agents.length
        ? new Set()
        : new Set(agents.map((a) => a.id)),
    );
  }, [agents]);

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} agent${selected.size > 1 ? 's' : ''}? This cannot be undone.`,
      )
    )
      return;
    startBulkTransition(async () => {
      await Promise.allSettled(
        [...selected].map((id) => destroyAgentAction({ agentId: id })),
      );
      setSelected(new Set());
    });
  };

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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950/40">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isBulkDeleting ? 'Deleting...' : `Delete ${selected.size}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground text-xs hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Agent grid */}
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={agents.length > 0 && selected.size === agents.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < agents.length;
                  }}
                  onChange={toggleAll}
                  className="accent-red-600"
                />
              </th>
              <th className="px-4 py-2 text-left font-medium">Agent</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">IP</th>
              <th className="px-4 py-2 text-left font-medium">Session</th>
              <th className="px-4 py-2 text-left font-medium">Uptime</th>
              <th className="px-4 py-2 text-left font-medium">Last Health</th>
              <th className="px-4 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {agents.map((agent) => (
              <AgentTableRow
                key={agent.id}
                agent={agent}
                isSelected={selected.has(agent.id)}
                onToggle={toggleOne}
              />
            ))}
            {agents.length === 0 && (
              <tr>
                <td
                  colSpan={8}
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

function AgentTableRow({
  agent,
  isSelected,
  onToggle,
}: {
  agent: PoolAgent;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const canStop = agent.status === 'interviewing' || agent.status === 'in_meeting';

  const handleStop = () => {
    startTransition(async () => {
      await stopAgentAction({ agentId: agent.id });
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete agent ${agent.container_name ?? agent.id}? This cannot be undone.`)) return;
    startTransition(async () => {
      await destroyAgentAction({ agentId: agent.id });
    });
  };

  return (
    <tr className={`hover:bg-muted/30 ${isSelected ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(agent.id)}
          className="accent-red-600"
        />
      </td>
      <td className="px-4 py-2">
        <Link
          href={`/home/pool/${agent.id}`}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {agent.container_name ?? agent.container_id.substring(0, 12)}
        </Link>
      </td>
      <td className="px-4 py-2">
        <AgentStatusBadge status={agent.status} />
      </td>
      <td className="px-4 py-2 text-xs">{agent.internal_ip ?? '-'}</td>
      <td className="px-4 py-2 font-mono text-xs">
        {agent.session_id?.substring(0, 8) ?? '-'}
      </td>
      <td className="text-muted-foreground px-4 py-2 text-xs">
        {formatDistanceToNow(new Date(agent.started_at), { addSuffix: false })}
      </td>
      <td className="text-muted-foreground px-4 py-2 text-xs">
        {agent.last_health_check
          ? formatDistanceToNow(new Date(agent.last_health_check), { addSuffix: true })
          : '-'}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          {canStop && (
            <button
              onClick={handleStop}
              disabled={isPending}
              className="rounded p-1 text-orange-600 hover:bg-orange-100 disabled:opacity-50 dark:text-orange-400 dark:hover:bg-orange-900/30"
              title="Stop interview"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
            title="Delete agent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
