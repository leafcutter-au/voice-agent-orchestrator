import { z } from 'zod';

export const AgentStatusEnum = z.enum([
  'starting',
  'warm',
  'active',
  'draining',
  'failed',
]);

export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const ScaleUpSchema = z.object({
  count: z.number().int().positive().max(20),
});

export const ScaleDownSchema = z.object({
  count: z.number().int().positive().max(20),
});

export const DestroyAgentSchema = z.object({
  agentId: z.string().uuid(),
});

export type ScaleUpInput = z.infer<typeof ScaleUpSchema>;
export type ScaleDownInput = z.infer<typeof ScaleDownSchema>;
export type DestroyAgentInput = z.infer<typeof DestroyAgentSchema>;
