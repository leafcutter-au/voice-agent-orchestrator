'use client';

import { useQuery } from '@tanstack/react-query';

interface AgentStatus {
  session_id: string | null;
  status: string;
  current_topic: string | null;
  topics_covered: string[];
  elapsed_secs: number;
  topic_status: Record<string, {
    status?: string;
    sub_topics_covered?: number;
    sub_topics_total?: number;
    time_spent_secs?: number;
  }>;
}

async function fetchAgentStatus(agentId: string): Promise<AgentStatus> {
  const resp = await fetch(`/api/pool/${agentId}/status`);
  if (!resp.ok) throw new Error('Failed to fetch status');
  return resp.json();
}

export function useAgentStatus(agentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['agent-status', agentId],
    queryFn: () => fetchAgentStatus(agentId),
    refetchInterval: enabled ? 5000 : false,
    enabled,
  });
}
