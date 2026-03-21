'use client';

import { Cpu, HardDrive, Wifi } from 'lucide-react';
import { useContainerStats } from '@/hooks/use-container-stats';

interface ResourceUsageProps {
  agentId: string;
  isActive: boolean;
}

export function ResourceUsage({ agentId, isActive }: ResourceUsageProps) {
  const { data: stats, isLoading, isError } = useContainerStats(agentId, isActive);

  return (
    <div className="border-border rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Resource Usage</h3>
        {isActive && (
          <span className="text-muted-foreground text-xs">Polling every 10s</span>
        )}
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading stats...</p>
      )}

      {isError && (
        <p className="text-muted-foreground text-sm">Could not fetch container stats.</p>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* CPU */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" />
              <span>CPU</span>
              <span className="ml-auto font-mono text-xs">{stats.cpu_percent}%</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.cpu_percent > 80 ? 'bg-red-500' : stats.cpu_percent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(stats.cpu_percent, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4" />
              <span>Memory</span>
              <span className="ml-auto font-mono text-xs">
                {stats.memory_usage_mb} / {stats.memory_limit_mb} MB
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.memory_usage_mb / stats.memory_limit_mb > 0.8
                    ? 'bg-red-500'
                    : stats.memory_usage_mb / stats.memory_limit_mb > 0.5
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min((stats.memory_usage_mb / stats.memory_limit_mb) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Network */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4" />
              <span>Network</span>
            </div>
            <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-green-500">RX:</span> {stats.network_rx_mb} MB
              </div>
              <div>
                <span className="text-blue-500">TX:</span> {stats.network_tx_mb} MB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
