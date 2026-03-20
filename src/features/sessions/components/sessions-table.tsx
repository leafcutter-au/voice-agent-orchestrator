'use client';

import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { SessionStatusBadge } from './session-status-badge';
import { useRealtimeTable } from '@/hooks/use-realtime';
import type { Database } from '@/lib/supabase/database.types';
import type { SessionStatus } from '../sessions.schema';

type Session = Database['public']['Tables']['voice_sessions']['Row'];

interface SessionsTableProps {
  sessions: Session[];
  totalCount: number;
}

export function SessionsTable({ sessions, totalCount }: SessionsTableProps) {
  useRealtimeTable('voice_sessions', ['sessions']);

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        {totalCount} session{totalCount !== 1 ? 's' : ''}
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">Stakeholder</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Started</th>
              <th className="px-4 py-2 text-left font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-muted/30">
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
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
