import { getTestModeState } from '@/features/testing/testing.state';

export function TestModeBanner() {
  const { enabled } = getTestModeState();
  if (!enabled) return null;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/15 px-6 py-2 text-center text-sm font-medium text-amber-600 dark:text-amber-400">
      TEST MODE — agents will run simulated interviews
    </div>
  );
}
