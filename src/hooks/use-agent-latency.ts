'use client';

import { useQuery } from '@tanstack/react-query';

export interface LatencyEvent {
  event: string;
  ts: number;
  turn?: number;
  // Turn breakdown fields (event: "turn_breakdown")
  stt_ms?: number;
  llm_ttft_ms?: number;
  llm_generation_ms?: number;
  tts_to_audio_ms?: number;
  func_call_ms?: number;
  func_call_count?: number;
  total_ms?: number;
  // Summary fields (event: "summary")
  total_turns?: number;
  measured_responses?: number;
  interruptions?: number;
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
