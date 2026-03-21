'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AudioDevice {
  id: string;
  name: string;
  module: string;
  state: string;
}

interface AudioHealthData {
  pulseaudio_running: boolean;
  sinks: AudioDevice[];
  sources: AudioDevice[];
  sink_inputs: AudioDevice[];
  source_outputs: AudioDevice[];
}

async function fetchAudioHealth(agentId: string): Promise<AudioHealthData> {
  const resp = await fetch(`/api/pool/${agentId}/audio`);
  if (!resp.ok) throw new Error('Failed to fetch audio health');
  return resp.json();
}

interface AudioHealthProps {
  agentId: string;
}

export function AudioHealth({ agentId }: AudioHealthProps) {
  const [loaded, setLoaded] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audio-health', agentId],
    queryFn: () => fetchAudioHealth(agentId),
    enabled: loaded,
  });

  const handleLoad = () => {
    if (!loaded) {
      setLoaded(true);
    } else {
      refetch();
    }
  };

  const hasDevices = data && (
    data.sinks.length > 0 || data.sources.length > 0
    || data.sink_inputs.length > 0 || data.source_outputs.length > 0
  );

  return (
    <div className="border-border rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Audio Routing</h3>
          {data && (
            <span
              className={`h-2 w-2 rounded-full ${data.pulseaudio_running ? 'bg-green-500' : 'bg-red-500'}`}
              title={data.pulseaudio_running ? 'PulseAudio running' : 'PulseAudio not running'}
            />
          )}
        </div>
        <button
          onClick={handleLoad}
          disabled={isFetching}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded p-1 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {loaded ? 'Refresh' : 'Load'}
        </button>
      </div>

      {!loaded && (
        <p className="text-muted-foreground text-sm">
          Click &quot;Load&quot; to inspect PulseAudio routing inside the container.
        </p>
      )}

      {loaded && isFetching && !data && <p className="text-muted-foreground text-sm">Loading...</p>}

      {data && !data.pulseaudio_running && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm dark:bg-red-950/30">
          <span className="font-medium text-red-700 dark:text-red-300">
            PulseAudio is not running.
          </span>
          <span className="text-muted-foreground ml-1">
            It may have exited after initial setup. Audio routing cannot be inspected until PulseAudio is restarted.
          </span>
        </div>
      )}

      {data && data.pulseaudio_running && !hasDevices && (
        <p className="text-muted-foreground text-sm">
          PulseAudio is running but no devices are loaded.
        </p>
      )}

      {hasDevices && (
        <div className="space-y-4">
          <AudioTable title="Sinks (Playback)" items={data!.sinks} />
          <AudioTable title="Sources (Capture)" items={data!.sources} />
          <AudioTable title="Sink Inputs (Playback Streams)" items={data!.sink_inputs} />
          <AudioTable title="Source Outputs (Capture Streams)" items={data!.source_outputs} />
        </div>
      )}
    </div>
  );
}

function AudioTable({ title, items }: { title: string; items: AudioDevice[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-muted-foreground mb-1 text-xs font-medium">{title}</h4>
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-1 text-left">ID</th>
            <th className="px-2 py-1 text-left">Name</th>
            <th className="px-2 py-1 text-left">Module</th>
            <th className="px-2 py-1 text-left">State</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {items.map((item, i) => (
            <tr key={i}>
              <td className="px-2 py-1 font-mono">{item.id}</td>
              <td className="px-2 py-1 font-mono">{item.name}</td>
              <td className="px-2 py-1">{item.module}</td>
              <td className="px-2 py-1">
                <span
                  className={`inline-flex rounded-full px-1.5 py-0.5 text-xs ${
                    item.state === 'RUNNING'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : item.state === 'SUSPENDED'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}
                >
                  {item.state}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
