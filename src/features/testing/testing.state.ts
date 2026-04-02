import 'server-only';

import type { IntervieweeProfile } from './testing.defaults';

export interface TestModeState {
  enabled: boolean;
  intervieweeProfile: IntervieweeProfile | null;
}

const DEFAULT_STATE: TestModeState = {
  enabled: false,
  intervieweeProfile: null,
};

declare global {
  var __testModeState: TestModeState | undefined;
}

function ensureState(): TestModeState {
  if (!globalThis.__testModeState) {
    globalThis.__testModeState = { ...DEFAULT_STATE };
  }
  return globalThis.__testModeState;
}

export function getTestModeState(): TestModeState {
  return ensureState();
}

export function setTestModeState(state: TestModeState): void {
  globalThis.__testModeState = state;
}
