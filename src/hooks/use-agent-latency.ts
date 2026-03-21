'use client';

import { useQuery } from '@tanstack/react-query';

export interface LatencyEvent {
  type: string;
  turn?: number;
  stt_ms?: number;
  llm_ttft_ms?: number;
  llm_gen_ms?: number;
  tts_ms?: number;
  total_ms?: number;
  // Summary fields
  p50?: Record<string, number>;
  p95?: Record<string, number>;
  mean?: Record<string, number>;
  [key: string]: unknown;
}

async function fetchLatencyData(agentId: string): Promise<LatencyEvent[]> {
  const resp = await fetch(`/api/pool/${agentId}/latency`);
  if (!resp.ok) throw new Error('Failed to fetch latency data');
  const data = await resp.json();
  return data.events ?? [];
}

export function useAgentLatency(agentId: string, isActive: boolean) {
  return useQuery({
    queryKey: ['agent-latency', agentId],
    queryFn: () => fetchLatencyData(agentId),
    refetchInterval: isActive ? 15000 : false,
  });
}
