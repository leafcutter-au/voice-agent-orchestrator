export const dynamic = 'force-dynamic';

import { getTestModeState } from '@/features/testing/testing.state';
import { TestModeConfig } from '@/features/testing/components/test-mode-config';

export default function TestingPage() {
  const state = getTestModeState();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Testing</h1>
      <TestModeConfig initialState={state} />
    </div>
  );
}
