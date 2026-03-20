'use client';

import { format } from 'date-fns';
import type { Database } from '@/lib/supabase/database.types';

type Event = Database['public']['Tables']['session_events']['Row'];

const eventLabels: Record<string, string> = {
  session_created: 'Session created',
  agent_assigned: 'Agent assigned',
  interview_completed: 'Interview completed',
  interview_failed: 'Interview failed',
  stop_requested: 'Stop requested',
  session_cancelled: 'Session cancelled',
};

export function SessionEvents({ events }: { events: Event[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Event Timeline</h2>

      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="border-border flex items-start gap-3 border-l-2 pl-4 py-2"
          >
            <div className="flex-1">
              <div className="text-sm font-medium">
                {eventLabels[event.event_type] ?? event.event_type}
              </div>
              {event.event_data &&
                typeof event.event_data === 'object' &&
                Object.keys(event.event_data).length > 0 && (
                  <pre className="text-muted-foreground mt-1 text-xs">
                    {JSON.stringify(event.event_data, null, 2)}
                  </pre>
                )}
            </div>
            <div className="text-muted-foreground shrink-0 text-xs">
              {format(new Date(event.created_at), 'HH:mm:ss')}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-muted-foreground text-sm">No events yet</div>
        )}
      </div>
    </div>
  );
}
