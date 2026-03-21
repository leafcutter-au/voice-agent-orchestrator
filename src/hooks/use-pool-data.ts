'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type AgentRow = Database['public']['Tables']['pool_agents']['Row'];

async function fetchPoolData() {
  const supabase = createClient();

  const { data: agents, error } = await supabase
    .from('pool_agents')
    .select('*')
    .order('started_at', { ascending: false })
    .returns<AgentRow[]>();

  if (error) throw error;

  const counts: Record<string, number> = {
    starting: 0,
    warm: 0,
    assigned: 0,
    joining: 0,
    in_meeting: 0,
    interviewing: 0,
    draining: 0,
    failed: 0,
  };
  for (const a of agents ?? []) {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  }

  return { agents: (agents ?? []) as AgentRow[], counts };
}

export function usePoolData(initialData?: {
  agents: AgentRow[];
  counts: Record<string, number>;
}) {
  return useQuery({
    queryKey: ['pool-agents'],
    queryFn: fetchPoolData,
    initialData,
    refetchInterval: 30_000,
  });
}
