'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LogLine {
  text: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

const MAX_LINES = 1000;

export function useContainerLogs(agentId: string) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const bufferRef = useRef<LogLine[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isPaused) return;

    const es = new EventSource(`/api/pool/${agentId}/logs`);
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.closed) {
          setIsConnected(false);
          return;
        }
        const line: LogLine = {
          text: data.text,
          stream: data.stream,
          timestamp: Date.now(),
        };
        bufferRef.current = [...bufferRef.current, line].slice(-MAX_LINES);
        setLines(bufferRef.current);
      } catch {
        // skip malformed events
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, isPaused]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setLines([]);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  return { lines, isConnected, isPaused, clear, togglePause };
}
