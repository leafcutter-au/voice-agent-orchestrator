'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface PipecatLogsPanelProps {
  agentId: string;
}

async function fetchPipecatLogs(agentId: string): Promise<string> {
  const resp = await fetch(`/api/pool/${agentId}/pipecat-logs`);
  if (!resp.ok) throw new Error('Failed to fetch pipecat logs');
  const data = await resp.json();
  return data.logs ?? '';
}

const levelColors: Record<string, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-blue-400',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500 font-bold',
  SUCCESS: 'text-green-400',
};

function getLineColor(line: string): string {
  for (const [level, color] of Object.entries(levelColors)) {
    if (line.includes(level)) return color;
  }
  return 'text-gray-300';
}

export function PipecatLogsPanel({ agentId }: PipecatLogsPanelProps) {
  const [loaded, setLoaded] = useState(false);

  const { data: logs, isFetching, refetch } = useQuery({
    queryKey: ['pipecat-logs', agentId],
    queryFn: () => fetchPipecatLogs(agentId),
    enabled: loaded,
  });

  const lines = logs?.split('\n').filter(Boolean) ?? [];

  const handleLoad = () => {
    if (!loaded) {
      setLoaded(true);
    } else {
      refetch();
    }
  };

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="bg-muted/50 flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-medium">Pipecat Logs</h3>
        <button
          onClick={handleLoad}
          disabled={isFetching}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded p-1 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {loaded ? 'Refresh' : 'Load'}
        </button>
      </div>
      <div className="h-72 overflow-auto bg-gray-950 p-3 font-mono text-xs leading-relaxed">
        {!loaded && (
          <div className="text-gray-500">Click &quot;Load&quot; to fetch pipecat logs from the container.</div>
        )}
        {loaded && isFetching && lines.length === 0 && (
          <div className="text-gray-500">Loading...</div>
        )}
        {loaded && !isFetching && lines.length === 0 && (
          <div className="text-gray-500">No pipecat logs found in the container.</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={getLineColor(line)}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
