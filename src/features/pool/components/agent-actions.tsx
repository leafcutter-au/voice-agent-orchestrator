'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Square, Trash2 } from 'lucide-react';
import { stopAgentAction, destroyAgentAction } from '../server-actions';

interface AgentActionsProps {
  agentId: string;
  status: string;
  agentName: string;
}

export function AgentActions({ agentId, status, agentName }: AgentActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const canStop = status === 'interviewing' || status === 'in_meeting';

  const handleStop = () => {
    startTransition(async () => {
      await stopAgentAction({ agentId });
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete agent ${agentName}? This will destroy the container and cannot be undone.`)) return;
    startTransition(async () => {
      await destroyAgentAction({ agentId });
      router.push('/home/pool');
    });
  };

  return (
    <div className="flex items-center gap-2">
      {canStop && (
        <button
          onClick={handleStop}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}
