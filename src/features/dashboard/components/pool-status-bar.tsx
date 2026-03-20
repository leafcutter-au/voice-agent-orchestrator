interface PoolStatusBarProps {
  counts: Record<string, number>;
}

export function PoolStatusBar({ counts }: PoolStatusBarProps) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground text-sm">No agents in pool</div>
    );
  }

  const segments = [
    { key: 'warm', color: 'bg-green-500', label: 'Warm' },
    { key: 'active', color: 'bg-blue-500', label: 'Active' },
    { key: 'starting', color: 'bg-yellow-500', label: 'Starting' },
    { key: 'draining', color: 'bg-orange-500', label: 'Draining' },
    { key: 'failed', color: 'bg-red-500', label: 'Failed' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-4 overflow-hidden rounded-full">
        {segments
          .filter((s) => (counts[s.key] ?? 0) > 0)
          .map((s) => (
            <div
              key={s.key}
              className={s.color}
              style={{ width: `${((counts[s.key] ?? 0) / total) * 100}%` }}
              title={`${s.label}: ${counts[s.key]}`}
            />
          ))}
      </div>
      <div className="flex gap-4 text-xs">
        {segments
          .filter((s) => (counts[s.key] ?? 0) > 0)
          .map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-muted-foreground">
                {s.label}: {counts[s.key]}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
