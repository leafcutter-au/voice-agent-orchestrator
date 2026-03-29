'use server';

import { revalidatePath } from 'next/cache';
import { enhanceAction } from '@/lib/actions/enhance-action';
import { createPoolService } from './pool.service';
import { ScaleUpSchema, ScaleDownSchema, DestroyAgentSchema, StopAgentSchema } from './pool.schema';

export const scaleUpAction = enhanceAction(
  async (data: { count: number }) => {
    const service = createPoolService();
    const results = await service.scaleUp(data.count);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    revalidatePath('/home/pool');
    return { success: true, spawned: succeeded };
  },
  { auth: true, schema: ScaleUpSchema },
);

export const scaleDownAction = enhanceAction(
  async (data: { count: number }) => {
    const service = createPoolService();
    const destroyed = await service.scaleDown(data.count);
    revalidatePath('/home/pool');
    return { success: true, destroyed };
  },
  { auth: true, schema: ScaleDownSchema },
);

export const destroyAgentAction = enhanceAction(
  async (data: { agentId: string }) => {
    const service = createPoolService();
    await service.destroyAgent(data.agentId);
    revalidatePath('/home/pool');
    return { success: true };
  },
  { auth: true, schema: DestroyAgentSchema },
);

export const getAgentAction = enhanceAction(
  async (data: { agentId: string }) => {
    const service = createPoolService();
    const { agent } = await service.getAgentWithSession(data.agentId);
    return { success: true, agent };
  },
  { auth: true, schema: DestroyAgentSchema },
);

export const stopAgentAction = enhanceAction(
  async (data: { agentId: string }) => {
    const service = createPoolService();
    await service.stopAgent(data.agentId);
    revalidatePath(`/home/pool/${data.agentId}`);
    revalidatePath('/home/pool');
    return { success: true };
  },
  { auth: true, schema: StopAgentSchema },
);
