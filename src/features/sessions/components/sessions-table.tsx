'use client';

import { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { SessionStatusBadge } from './session-status-badge';
import { deleteSessionAction } from '../server-actions';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { useSessionsData } from '@/hooks/use-sessions-data';
import type { Database } from '@/lib/supabase/database.types';
import type { SessionStatus } from '../sessions.schema';

type Session = Database['public']['Tables']['voice_sessions']['Row'];

const DELETABLE_STATUSES = ['completed', 'failed', 'cancelled'];

interface SessionsTableProps {
  initialSessions: Session[];
  initialCount: number;
}

export function SessionsTable({
  initialSessions,
  initialCount,
}: SessionsTableProps) {
  const { data } = useSessionsData({
    sessions: initialSessions,
    count: initialCount,
  });
  useRealtimeTable('voice_sessions', ['sessions']);

  const sessions = data?.sessions ?? initialSessions;
  const totalCount = data?.count ?? initialCount;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, startBulkTransition] = useTransition();

  // Clear selection for sessions that no longer exist
  const sessionIds = new Set(sessions.map((s) => s.id));
  const validSelected = new Set([...selected].filter((id) => sessionIds.has(id)));
  if (validSelected.size !== selected.size && selected.size > 0) {
    setSelected(validSelected);
  }

  // Only deletable sessions can be selected
  const deletableSessions = sessions.filter((s) => DELETABLE_STATUSES.includes(s.status));

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
      prev.size === deletableSessions.length
        ? new Set()
        : new Set(deletableSessions.map((s) => s.id)),
    );
  }, [deletableSessions]);

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `Delete ${selected.size} session${selected.size > 1 ? 's' : ''}? All associated data will be permanently removed.`,
      )
    )
      return;
    startBulkTransition(async () => {
      await Promise.allSettled(
        [...selected].map((id) => deleteSessionAction({ sessionId: id })),
      );
      setSelected(new Set());
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        {totalCount} session{totalCount !== 1 ? 's' : ''}
      </div>

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

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={deletableSessions.length > 0 && selected.size === deletableSessions.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < deletableSessions.length;
                  }}
                  onChange={toggleAll}
                  className="accent-red-600"
                  title="Select all deletable sessions"
                />
              </th>
              <th className="px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">Stakeholder</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Started</th>
              <th className="px-4 py-2 text-left font-medium">Duration</th>
              <th className="px-4 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sessions.map((session) => (
              <SessionTableRow
                key={session.id}
                session={session}
                isSelected={selected.has(session.id)}
                onToggle={toggleOne}
              />
            ))}
            {sessions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  No sessions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionTableRow({
  session,
  isSelected,
  onToggle,
}: {
  session: Session;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const canDelete = DELETABLE_STATUSES.includes(session.status);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this session? All associated data will be permanently removed.')) return;
    startTransition(async () => {
      await deleteSessionAction({ sessionId: session.id });
    });
  };

  return (
    <tr className={`hover:bg-muted/30 ${isSelected ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
      <td className="px-3 py-2">
        {canDelete ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(session.id)}
            className="accent-red-600"
          />
        ) : (
          <span />
        )}
      </td>
      <td className="px-4 py-2">
        <Link
          href={`/home/sessions/${session.id}`}
          className="text-primary font-mono text-xs hover:underline"
        >
          {session.id.substring(0, 8)}
        </Link>
      </td>
      <td className="px-4 py-2">
        <div className="font-medium">
          {session.stakeholder_name ?? '-'}
        </div>
        <div className="text-muted-foreground text-xs">
          {session.stakeholder_role ?? ''}
        </div>
      </td>
      <td className="px-4 py-2">
        <SessionStatusBadge
          status={session.status as SessionStatus}
        />
      </td>
      <td className="text-muted-foreground px-4 py-2 text-xs">
        {session.started_at
          ? format(new Date(session.started_at), 'MMM d, HH:mm')
          : '-'}
      </td>
      <td className="text-muted-foreground px-4 py-2 text-xs">
        {session.duration_seconds
          ? `${Math.round(session.duration_seconds / 60)}m`
          : session.started_at
            ? formatDistanceToNow(new Date(session.started_at))
            : '-'}
      </td>
      <td className="px-4 py-2 text-right">
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
            title="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
