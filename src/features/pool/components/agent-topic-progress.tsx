'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useAgentStatus } from '@/hooks/use-agent-status';

interface AgentTopicProgressProps {
  agentId: string;
  isActive: boolean;
}

export function AgentTopicProgress({ agentId, isActive }: AgentTopicProgressProps) {
  const { data, isLoading, isError } = useAgentStatus(agentId, isActive);

  if (!isActive) {
    return (
      <div className="border-border rounded-lg border p-6">
        <h3 className="mb-3 text-sm font-medium">Interview Progress</h3>
        <p className="text-muted-foreground text-sm">Agent is not in an active session.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-border rounded-lg border p-6">
        <h3 className="mb-3 text-sm font-medium">Interview Progress</h3>
        <p className="text-muted-foreground text-sm">Could not fetch agent status.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="border-border rounded-lg border p-6">
        <h3 className="mb-3 text-sm font-medium">Interview Progress</h3>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  const topics = Object.entries(data.topic_status);
  const elapsedMins = Math.floor(data.elapsed_secs / 60);
  const elapsedSecs = data.elapsed_secs % 60;

  return (
    <div className="border-border rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Interview Progress</h3>
        <span className="text-muted-foreground font-mono text-xs">
          {elapsedMins}:{String(elapsedSecs).padStart(2, '0')} elapsed
        </span>
      </div>

      {data.current_topic && (
        <div className="mb-4 rounded-md bg-purple-50 px-3 py-2 text-sm dark:bg-purple-950/30">
          <span className="text-muted-foreground text-xs">Current topic:</span>
          <div className="font-medium text-purple-700 dark:text-purple-300">
            {data.current_topic}
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <p className="text-muted-foreground text-sm">No topics tracked yet.</p>
      ) : (
        <div className="space-y-3">
          {topics.map(([name, info]) => {
            const isCurrent = name === data.current_topic;
            const isCovered = info.status === 'covered' || info.status === 'skipped_time';
            const subProgress = info.sub_topics_total
              ? (info.sub_topics_covered ?? 0) / info.sub_topics_total
              : 0;

            let statusColor = 'text-muted-foreground';
            if (info.status === 'topic_target_reached') statusColor = 'text-yellow-600 dark:text-yellow-400';
            if (info.status === 'topic_max_reached' || info.status === 'interview_ending') statusColor = 'text-red-600 dark:text-red-400';

            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center gap-2">
                  {isCovered ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  ) : (
                    <Circle className="text-muted-foreground h-4 w-4" />
                  )}
                  <span className={`text-sm ${isCurrent ? 'font-medium' : ''}`}>
                    {name}
                  </span>
                  {info.status && (
                    <span className={`text-xs ${statusColor}`}>
                      {info.status.replaceAll('_', ' ')}
                    </span>
                  )}
                </div>
                {info.sub_topics_total && info.sub_topics_total > 0 && (
                  <div className="ml-6 flex items-center gap-2">
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all"
                        style={{ width: `${subProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {info.sub_topics_covered ?? 0}/{info.sub_topics_total}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
