'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Json } from '@/lib/supabase/database.types';

interface TranscriptEntry {
  turn: number;
  timestamp: string;
  speaker: 'interviewer' | 'interviewee';
  speaker_name: string;
  text: string;
}

interface TranscriptProps {
  results: Json;
}

export function Transcript({ results }: TranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  if (!results || typeof results !== 'object' || Array.isArray(results)) return null;

  const r = results as Record<string, unknown>;
  const entries = r.transcript as TranscriptEntry[] | undefined;
  if (!entries || !Array.isArray(entries) || entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-lg font-semibold hover:opacity-80"
      >
        {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        Transcript
        <span className="text-muted-foreground text-sm font-normal">
          ({entries.length} turns)
        </span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <TranscriptMessage key={entry.turn} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptMessage({ entry }: { entry: TranscriptEntry }) {
  const isInterviewer = entry.speaker === 'interviewer';

  return (
    <div className={`flex ${isInterviewer ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isInterviewer
            ? 'bg-muted'
            : 'bg-primary/10 dark:bg-primary/20'
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium">
            {entry.speaker_name}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return format(new Date(ts), 'HH:mm:ss');
  } catch {
    return ts;
  }
}
