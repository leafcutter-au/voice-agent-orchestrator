'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Json } from '@/lib/supabase/database.types';

interface TranscriptEntry {
  turn: number;
  timestamp: string;
  speaker: 'interviewer' | 'interviewee';
  speaker_name: string;
  text: string;
}

interface MergedBlock {
  timestamp: string;
  speaker: 'interviewer' | 'interviewee';
  speaker_name: string;
  text: string;
}

interface TranscriptProps {
  results: Json;
}

function mergeConsecutiveEntries(entries: TranscriptEntry[]): MergedBlock[] {
  const blocks: MergedBlock[] = [];

  for (const entry of entries) {
    const prev = blocks[blocks.length - 1];
    if (prev && prev.speaker === entry.speaker) {
      prev.text += ' ' + entry.text;
    } else {
      blocks.push({
        timestamp: entry.timestamp,
        speaker: entry.speaker,
        speaker_name: entry.speaker_name,
        text: entry.text,
      });
    }
  }

  return blocks;
}

function formatRelativeTimestamp(ts: string, startTs: string): string {
  try {
    const diffMs = new Date(ts).getTime() - new Date(startTs).getTime();
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } catch {
    return ts;
  }
}

export function Transcript({ results }: TranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  if (!results || typeof results !== 'object' || Array.isArray(results)) return null;

  const r = results as Record<string, unknown>;
  const entries = r.transcript as TranscriptEntry[] | undefined;
  if (!entries || !Array.isArray(entries) || entries.length === 0) return null;

  const blocks = mergeConsecutiveEntries(entries);
  const startTs = entries[0].timestamp;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-lg font-semibold hover:opacity-80"
      >
        {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        Transcript
        <span className="text-muted-foreground text-sm font-normal">
          ({blocks.length} exchanges)
        </span>
      </button>

      {expanded && (
        <div className="border-l-2 border-muted">
          {blocks.map((block, i) => (
            <TranscriptRow key={i} block={block} startTs={startTs} />
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptRow({ block, startTs }: { block: MergedBlock; startTs: string }) {
  const isInterviewer = block.speaker === 'interviewer';

  return (
    <div className="flex items-start gap-3 py-3 pl-4">
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-xs font-mono ${
          isInterviewer
            ? 'bg-foreground text-background'
            : 'bg-muted text-foreground'
        }`}
      >
        {formatRelativeTimestamp(block.timestamp, startTs)}
      </span>
      <span className="shrink-0 text-sm font-medium w-28">
        {block.speaker_name}
      </span>
      <p className="text-sm whitespace-pre-wrap">{block.text}</p>
    </div>
  );
}
