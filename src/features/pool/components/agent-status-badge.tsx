import { cn } from '@/lib/utils';
import type { AgentStatus } from '../pool.schema';

const statusStyles: Record<AgentStatus, string> = {
  starting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  warm: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  draining: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
