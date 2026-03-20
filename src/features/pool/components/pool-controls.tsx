'use client';

import { useState, useTransition } from 'react';
import { scaleUpAction, scaleDownAction } from '../server-actions';
import { Plus, Minus } from 'lucide-react';

export function PoolControls() {
  const [count, setCount] = useState(1);
  const [isPending, startTransition] = useTransition();

  function handleScaleUp() {
    startTransition(async () => {
      await scaleUpAction({ count });
    });
  }

  function handleScaleDown() {
    startTransition(async () => {
      await scaleDownAction({ count });
    });
  }

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Scale:</label>
      <input
        type="number"
        min={1}
        max={20}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        className="border-input bg-background w-16 rounded-md border px-2 py-1 text-sm"
      />
      <button
        onClick={handleScaleUp}
        disabled={isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
        Scale Up
      </button>
      <button
        onClick={handleScaleDown}
        disabled={isPending}
        className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        <Minus className="h-3 w-3" />
        Scale Down
      </button>
    </div>
  );
}
