'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useAgentLatency, type LatencyEvent } from '@/hooks/use-agent-latency';

interface LatencyDashboardProps {
  agentId: string;
  isActive: boolean;
}

const COLORS = {
  stt: '#3b82f6',
  llm_ttft: '#8b5cf6',
  llm_gen: '#a855f7',
  tts: '#ec4899',
  total: '#f97316',
};

export function LatencyDashboard({ agentId, isActive }: LatencyDashboardProps) {
  const { data: events, isLoading } = useAgentLatency(agentId, isActive);

  if (isLoading) {
    return (
      <div className="border-border rounded-lg border p-6">
        <h3 className="text-sm font-medium">Latency</h3>
        <p className="text-muted-foreground mt-2 text-sm">Loading latency data...</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="border-border rounded-lg border p-6">
        <h3 className="text-sm font-medium">Latency</h3>
        <p className="text-muted-foreground mt-2 text-sm">No latency data available yet.</p>
      </div>
    );
  }

  const turnEvents = events.filter((e) => e.type === 'turn' && e.turn != null);
  const summaryEvent = events.find((e) => e.type === 'summary');

  const chartData = turnEvents.map((e) => ({
    turn: e.turn,
    STT: e.stt_ms ?? 0,
    'LLM TTFT': e.llm_ttft_ms ?? 0,
    'LLM Gen': e.llm_gen_ms ?? 0,
    TTS: e.tts_ms ?? 0,
    Total: e.total_ms ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Stacked bar chart */}
      <div className="border-border rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium">Per-Turn Latency Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'bottom' }} />
            <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
              labelStyle={{ color: '#999' }}
            />
            <Legend />
            <Bar dataKey="STT" stackId="stack" fill={COLORS.stt} />
            <Bar dataKey="LLM TTFT" stackId="stack" fill={COLORS.llm_ttft} />
            <Bar dataKey="LLM Gen" stackId="stack" fill={COLORS.llm_gen} />
            <Bar dataKey="TTS" stackId="stack" fill={COLORS.tts} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Total response time line */}
      <div className="border-border rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium">Total Response Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="turn" />
            <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
            />
            <Line
              type="monotone"
              dataKey="Total"
              stroke={COLORS.total}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      {summaryEvent && (
        <div className="border-border rounded-lg border p-6">
          <h3 className="mb-4 text-sm font-medium">Summary Statistics</h3>
          <SummaryTable summary={summaryEvent} />
        </div>
      )}
    </div>
  );
}

function SummaryTable({ summary }: { summary: LatencyEvent }) {
  const metrics = ['stt', 'llm_ttft', 'llm_gen', 'tts', 'total'] as const;
  const labels: Record<string, string> = {
    stt: 'STT',
    llm_ttft: 'LLM TTFT',
    llm_gen: 'LLM Gen',
    tts: 'TTS',
    total: 'Total',
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-4 py-2 text-left font-medium">Component</th>
          <th className="px-4 py-2 text-right font-medium">p50 (ms)</th>
          <th className="px-4 py-2 text-right font-medium">p95 (ms)</th>
          <th className="px-4 py-2 text-right font-medium">Mean (ms)</th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {metrics.map((m) => (
          <tr key={m}>
            <td className="px-4 py-2">{labels[m]}</td>
            <td className="px-4 py-2 text-right font-mono text-xs">
              {summary.p50?.[m] ?? '-'}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs">
              {summary.p95?.[m] ?? '-'}
            </td>
            <td className="px-4 py-2 text-right font-mono text-xs">
              {summary.mean?.[m] ?? '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
