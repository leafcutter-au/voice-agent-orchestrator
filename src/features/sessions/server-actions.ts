'use server';

import { revalidatePath } from 'next/cache';
import { enhanceAction } from '@/lib/actions/enhance-action';
import { createSessionsService } from './sessions.service';
import { StopSessionSchema, CancelSessionSchema, DeleteSessionSchema } from './sessions.schema';

export const stopSessionAction = enhanceAction(
  async (data: { sessionId: string }) => {
    const service = createSessionsService();
    await service.stopSession(data.sessionId);
    revalidatePath(`/home/sessions/${data.sessionId}`);
    return { success: true };
  },
  { auth: true, schema: StopSessionSchema },
);

export const cancelSessionAction = enhanceAction(
  async (data: { sessionId: string }) => {
    const service = createSessionsService();
    await service.cancelSession(data.sessionId);
    revalidatePath('/home/sessions');
    return { success: true };
  },
  { auth: true, schema: CancelSessionSchema },
);

export const deleteSessionAction = enhanceAction(
  async (data: { sessionId: string }) => {
    const service = createSessionsService();
    await service.deleteSession(data.sessionId);
    revalidatePath('/home/sessions');
    return { success: true };
  },
  { auth: true, schema: DeleteSessionSchema },
);
