'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { SessionStatusBadge } from './session-status-badge';
import { FindingsSummary } from './findings-summary';
import { Transcript } from './transcript';
import { SessionDiagnostics } from './session-diagnostics';
import { stopSessionAction, cancelSessionAction, deleteSessionAction } from '../server-actions';
import { useRealtimeTable } from '@/hooks/use-realtime';
import { TopicProgress } from './topic-progress';
import type { Database } from '@/lib/supabase/database.types';
import type { SessionStatus } from '../sessions.schema';

type Session = Database['public']['Tables']['voice_sessions']['Row'];

interface SessionDetailProps {
  session: Session;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useRealtimeTable('voice_sessions', ['session', session.id], `id=eq.${session.id}`);

  const isActive = ['pending', 'connecting', 'active'].includes(session.status);
  const isCompleted = session.status === 'completed';
  const canDelete = ['completed', 'failed', 'cancelled'].includes(session.status);

  const handleDelete = () => {
    if (!window.confirm('Delete this session? All associated data will be permanently removed.')) return;
    startTransition(async () => {
      await deleteSessionAction({ sessionId: session.id });
      router.push('/home/sessions');
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              Session {session.id.substring(0, 8)}
            </h1>
            <SessionStatusBadge status={session.status as SessionStatus} failureReason={session.failure_reason} />
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
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
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
        {session.pool_agent_id ? (
          <Link href={`/home/pool/${session.pool_agent_id}`} className="group">
            <div className="border-border rounded-lg border p-3 group-hover:border-primary/50 transition-colors">
              <div className="text-muted-foreground text-xs">Agent</div>
              <div className="mt-1 text-sm font-medium text-primary">
                {session.pool_agent_id.substring(0, 8)}
              </div>
            </div>
          </Link>
        ) : (
          <InfoCard label="Agent" value="Unassigned" />
        )}
      </div>

      {/* Topic progress (for active sessions) */}
      {isActive && session.interview_config && (
        <TopicProgress config={session.interview_config} />
      )}

      {/* Findings (for completed sessions) */}
      {isCompleted && session.results && (
        <FindingsSummary results={session.results} />
      )}

      {/* Transcript (for completed sessions) */}
      {isCompleted && session.results && (
        <Transcript results={session.results} />
      )}

      {/* Diagnostics (pipecat logs + latency data) */}
      {isCompleted && (
        <SessionDiagnostics
          pipecatLogs={session.pipecat_logs}
          latencyData={session.latency_data}
        />
      )}
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
