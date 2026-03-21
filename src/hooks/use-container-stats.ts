'use client';

import { useQuery } from '@tanstack/react-query';

export interface ContainerStats {
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  network_rx_mb: number;
  network_tx_mb: number;
}

async function fetchContainerStats(agentId: string): Promise<ContainerStats> {
  const resp = await fetch(`/api/pool/${agentId}/stats`);
  if (!resp.ok) throw new Error('Failed to fetch stats');
  return resp.json();
}

export function useContainerStats(agentId: string, pollWhileActive: boolean) {
  return useQuery({
    queryKey: ['container-stats', agentId],
    queryFn: () => fetchContainerStats(agentId),
    refetchInterval: pollWhileActive ? 10000 : false,
  });
}
