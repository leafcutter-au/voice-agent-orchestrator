import { cn } from '@/lib/utils';
import type { AgentStatus } from '../pool.schema';

const statusConfig: Record<AgentStatus, { style: string; label: string }> = {
  starting: {
    style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'Starting',
  },
  warm: {
    style: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Warm',
  },
  assigned: {
    style: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Assigned',
  },
  joining: {
    style: 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100',
    label: 'Joining Meeting',
  },
  in_meeting: {
    style: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    label: 'In Meeting',
  },
  interviewing: {
    style: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    label: 'Interviewing',
  },
  draining: {
    style: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    label: 'Draining',
  },
  failed: {
    style: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'Failed',
  },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status] ?? {
    style: 'bg-gray-100 text-gray-800',
    label: status,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.style,
      )}
    >
      {config.label}
    </span>
  );
}
