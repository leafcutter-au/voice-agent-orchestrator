'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { SessionStatusBadge } from '@/features/sessions/components/session-status-badge';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { useRecentSessions } from '@/hooks/use-sessions-data';
import type { Database } from '@/lib/supabase/database.types';
import type { SessionStatus } from '@/features/sessions/sessions.schema';

type Session = Database['public']['Tables']['voice_sessions']['Row'];

export function RecentSessions({
  initialSessions,
}: {
  initialSessions: Session[];
}) {
  const { data: sessions } = useRecentSessions(initialSessions);
  useRealtimeTable('voice_sessions', ['dashboard-sessions']);

  const displaySessions = sessions ?? initialSessions;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Sessions</h2>
        <Link
          href="/home/sessions"
          className="text-primary text-sm hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Stakeholder</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Started</th>
              <th className="px-4 py-2 text-left font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {displaySessions.map((session) => (
              <tr key={session.id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link
                    href={`/home/sessions/${session.id}`}
                    className="hover:underline"
                  >
                    {session.stakeholder_name ?? 'Unknown'}
                  </Link>
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
                    : '-'}
                </td>
              </tr>
            ))}
            {displaySessions.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  No sessions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
