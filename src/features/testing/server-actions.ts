'use server';

import { revalidatePath } from 'next/cache';
import { enhanceAction } from '@/lib/actions/enhance-action';
import { getTestModeState, setTestModeState } from './testing.state';
import { UpdateTestModeSchema } from './testing.schema';

export const updateTestModeAction = enhanceAction(
  async (data: { enabled: boolean; intervieweeProfile: { personality: string; expertise: { strong: string[]; weak: string[] }; instructions: string } | null }) => {
    setTestModeState({
      enabled: data.enabled,
      intervieweeProfile: data.intervieweeProfile,
    });
    revalidatePath('/home', 'layout');
    return { success: true };
  },
  { auth: true, schema: UpdateTestModeSchema },
);

export const getTestModeAction = enhanceAction(
  async () => {
    const state = getTestModeState();
    return { success: true, ...state };
  },
  { auth: true },
);
