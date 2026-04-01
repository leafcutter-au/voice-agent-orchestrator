'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Json } from '@/lib/supabase/database.types';

interface LatencyEntry {
  turn?: number;
  ttfb_ms?: number;
  total_ms?: number;
  stt_ms?: number;
  llm_ms?: number;
  tts_ms?: number;
  [key: string]: unknown;
}

interface SessionDiagnosticsProps {
  pipecatLogs: string | null;
  latencyData: Json | null;
}

export function SessionDiagnostics({ pipecatLogs, latencyData }: SessionDiagnosticsProps) {
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [latencyExpanded, setLatencyExpanded] = useState(false);

  const hasLogs = pipecatLogs && pipecatLogs.trim().length > 0;
  const entries = parseLatencyData(latencyData);
  const hasLatency = entries.length > 0;

  if (!hasLogs && !hasLatency) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Diagnostics</h2>

      {hasLatency && (
        <div className="border-border rounded-lg border">
          <button
            onClick={() => setLatencyExpanded(!latencyExpanded)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-80"
          >
            {latencyExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Latency Data
            <span className="text-muted-foreground text-xs font-normal">
              ({entries.length} entries)
            </span>
          </button>

          {latencyExpanded && (
            <div className="overflow-auto border-t border-border">
              <LatencyTable entries={entries} />
            </div>
          )}
        </div>
      )}

      {hasLogs && (
        <div className="border-border rounded-lg border">
          <button
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:opacity-80"
          >
            {logsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Pipecat Logs
          </button>

          {logsExpanded && (
            <pre className="max-h-96 overflow-auto border-t border-border p-4 text-xs">
              {pipecatLogs}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function parseLatencyData(data: Json | null): LatencyEntry[] {
  if (!data || !Array.isArray(data)) return [];
  return data as LatencyEntry[];
}

function LatencyTable({ entries }: { entries: LatencyEntry[] }) {
  // Collect all numeric keys across entries for dynamic columns
  const allKeys = new Set<string>();
  for (const entry of entries) {
    for (const key of Object.keys(entry)) {
      if (typeof entry[key] === 'number') allKeys.add(key);
    }
  }
  const columns = Array.from(allKeys).sort((a, b) => {
    // Put 'turn' first, then alphabetical
    if (a === 'turn') return -1;
    if (b === 'turn') return 1;
    return a.localeCompare(b);
  });

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-muted/50">
          {columns.map((col) => (
            <th key={col} className="px-3 py-2 text-left font-medium">
              {formatColumnName(col)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
          <tr key={i} className="border-t border-border">
            {columns.map((col) => (
              <td key={col} className="px-3 py-1.5 tabular-nums">
                {formatCell(col, entry[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatColumnName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b(ms|ttfb|stt|llm|tts)\b/gi, (m) => m.toUpperCase());
}

function formatCell(key: string, value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'number') {
    if (key === 'turn') return String(value);
    return `${Math.round(value)}ms`;
  }
  return String(value);
}
