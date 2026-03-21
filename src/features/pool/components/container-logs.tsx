'use client';

import { useEffect, useRef } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { useContainerLogs } from '@/hooks/use-container-logs';

interface ContainerLogsProps {
  agentId: string;
}

export function ContainerLogs({ agentId }: ContainerLogsProps) {
  const { lines, isConnected, isPaused, clear, togglePause } = useContainerLogs(agentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="bg-muted/50 flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Container Logs</h3>
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePause}
            className="text-muted-foreground hover:text-foreground rounded p-1"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={clear}
            className="text-muted-foreground hover:text-foreground rounded p-1"
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-96 overflow-auto bg-gray-950 p-3 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 && (
          <div className="text-gray-500">Waiting for log output...</div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className={line.stream === 'stderr' ? 'text-red-400' : 'text-gray-300'}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
