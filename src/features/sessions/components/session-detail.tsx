'use client';

import { useTransition } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { SessionStatusBadge } from './session-status-badge';
import { SessionEvents } from './session-events';
import { TopicProgress } from './topic-progress';
import { stopSessionAction, cancelSessionAction } from '../server-actions';
import { useRealtimeTable } from '@/hooks/use-realtime';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { SessionStatus } from '../sessions.schema';

type Session = Database['public']['Tables']['voice_sessions']['Row'];
type Event = Database['public']['Tables']['session_events']['Row'];

interface SessionDetailProps {
  session: Session;
  events: Event[];
}

export function SessionDetail({ session, events }: SessionDetailProps) {
  const [isPending, startTransition] = useTransition();

  useRealtimeTable('voice_sessions', ['session', session.id], `id=eq.${session.id}`);
  useRealtimeTable('session_events', ['session-events', session.id], `session_id=eq.${session.id}`);

  const isActive = ['pending', 'connecting', 'active'].includes(session.status);
  const isCompleted = session.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              Session {session.id.substring(0, 8)}
            </h1>
            <SessionStatusBadge status={session.status as SessionStatus} />
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {session.stakeholder_name && (
              <span>
                {session.stakeholder_name}
                {session.stakeholder_role && ` - ${session.stakeholder_role}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {session.status === 'active' && (
            <button
              onClick={() =>
                startTransition(async () => {
                  await stopSessionAction({ sessionId: session.id });
                })
              }
              disabled={isPending}
              className="bg-destructive text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Stop Interview
            </button>
          )}
          {session.status === 'pending' && (
            <button
              onClick={() =>
                startTransition(async () => {
                  await cancelSessionAction({ sessionId: session.id });
                })
              }
              disabled={isPending}
              className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoCard
          label="Meeting URL"
          value={session.meeting_url}
          truncate
        />
        <InfoCard
          label="Started"
          value={
            session.started_at
              ? format(new Date(session.started_at), 'MMM d, HH:mm:ss')
              : 'Not started'
          }
        />
        <InfoCard
          label="Duration"
          value={
            session.duration_seconds
              ? `${Math.round(session.duration_seconds / 60)} minutes`
              : session.started_at
                ? formatDistanceToNow(new Date(session.started_at))
                : '-'
          }
        />
        <InfoCard label="Agent" value={session.pool_agent_id?.substring(0, 8) ?? 'Unassigned'} />
      </div>

      {/* Topic progress (for active sessions) */}
      {isActive && session.interview_config && (
        <TopicProgress config={session.interview_config} />
      )}

      {/* Results (for completed sessions) */}
      {isCompleted && session.results && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Results</h2>
          <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(session.results, null, 2)}
          </pre>
        </div>
      )}

      {/* Event timeline */}
      <SessionEvents events={events} />
    </div>
  );
}

function InfoCard({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`mt-1 text-sm font-medium ${truncate ? 'truncate' : ''}`}
        title={truncate ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
