'use client';

import type { Json } from '@/lib/supabase/database.types';

interface Finding {
  status: string;
  summary: string | string[];
  agent_assessment?: string;
  sub_topics_covered?: string[];
  sub_topics_missed?: string[];
}

interface FindingsSummaryProps {
  results: Json;
}

const statusColors: Record<string, string> = {
  covered_sufficient: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  covered_partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  not_covered: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<string, string> = {
  covered_sufficient: 'Sufficient',
  covered_partial: 'Partial',
  not_covered: 'Not Covered',
};

export function FindingsSummary({ results }: FindingsSummaryProps) {
  if (!results || typeof results !== 'object' || Array.isArray(results)) return null;

  const r = results as Record<string, unknown>;
  const findings = r.findings_summary as Record<string, Finding> | undefined;
  if (!findings || typeof findings !== 'object') return null;

  const topics = Object.entries(findings);
  if (topics.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Findings</h2>
      <div className="grid gap-3">
        {topics.map(([topic, finding]) => (
          <FindingCard key={topic} topic={topic} finding={finding} />
        ))}
      </div>
    </div>
  );
}

function FindingCard({ topic, finding }: { topic: string; finding: Finding }) {
  const summaryText = Array.isArray(finding.summary)
    ? finding.summary.join(' ')
    : finding.summary;

  const colorClass = statusColors[finding.status] ?? 'bg-muted text-muted-foreground';
  const label = statusLabels[finding.status] ?? finding.status;

  return (
    <div className="border-border rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{topic}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{summaryText}</p>

      {finding.agent_assessment && (
        <p className="text-sm italic text-muted-foreground">{finding.agent_assessment}</p>
      )}

      {finding.sub_topics_covered && finding.sub_topics_covered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {finding.sub_topics_covered.map((st) => (
            <span
              key={st}
              className="bg-muted rounded px-2 py-0.5 text-xs"
            >
              {st}
            </span>
          ))}
        </div>
      )}

      {finding.sub_topics_missed && finding.sub_topics_missed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {finding.sub_topics_missed.map((st) => (
            <span
              key={st}
              className="rounded border border-dashed border-yellow-500/50 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-400"
            >
              {st} (missed)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
