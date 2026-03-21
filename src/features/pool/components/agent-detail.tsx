'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
import { AgentStatusBadge } from './agent-status-badge';
import { AgentActions } from './agent-actions';
import { ContainerLogs } from './container-logs';
import { AgentTopicProgress } from './agent-topic-progress';
import { InterviewConfigPanel } from './interview-config-panel';
import { PipecatLogsPanel } from './pipecat-logs-panel';
import { LatencyDashboard } from './latency-dashboard';
import { ResourceUsage } from './resource-usage';
import { AudioHealth } from './audio-health';

type PoolAgent = Database['public']['Tables']['pool_agents']['Row'];
type VoiceSession = Database['public']['Tables']['voice_sessions']['Row'];

interface AgentDetailProps {
  agent: PoolAgent;
  session: VoiceSession | null;
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'logs', label: 'Logs' },
  { id: 'performance', label: 'Performance' },
  { id: 'diagnostics', label: 'Diagnostics' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function AgentDetail({ agent, session }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const agentName = agent.container_name ?? agent.container_id.substring(0, 12);

  const isActive = ['assigned', 'joining', 'in_meeting', 'interviewing'].includes(agent.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/home/pool"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold">{agentName}</h1>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            Container {agent.container_id.substring(0, 12)}
          </p>
        </div>
        <AgentActions
          agentId={agent.id}
          status={agent.status}
          agentName={agentName}
        />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <InfoCard label="Container ID" value={agent.container_id.substring(0, 12)} mono />
        <InfoCard label="Internal IP" value={agent.internal_ip ?? '-'} mono />
        <InfoCard
          label="Session"
          value={agent.session_id?.substring(0, 8) ?? '-'}
          mono
          href={agent.session_id ? `/home/sessions/${agent.session_id}` : undefined}
        />
        <InfoCard
          label="Uptime"
          value={formatDistanceToNow(new Date(agent.started_at), { addSuffix: false })}
        />
        <InfoCard
          label="Last Health Check"
          value={
            agent.last_health_check
              ? formatDistanceToNow(new Date(agent.last_health_check), { addSuffix: true })
              : '-'
          }
        />
        <InfoCard
          label="VNC"
          value={agent.host_port ? `Port ${agent.host_port}` : 'N/A'}
          href={agent.host_port ? `vnc://localhost:${agent.host_port}` : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="border-border border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AgentTopicProgress agentId={agent.id} isActive={isActive} />
          {session && (
            <InterviewConfigPanel config={session.interview_config} />
          )}
        </div>
      )}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <ContainerLogs agentId={agent.id} />
          <PipecatLogsPanel agentId={agent.id} />
        </div>
      )}
      {activeTab === 'performance' && (
        <LatencyDashboard agentId={agent.id} isActive={agent.status === 'interviewing'} />
      )}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <ResourceUsage agentId={agent.id} isActive={isActive} />
          <AudioHealth agentId={agent.id} />
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`mt-1 text-sm ${mono ? 'font-mono' : ''}`}>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
