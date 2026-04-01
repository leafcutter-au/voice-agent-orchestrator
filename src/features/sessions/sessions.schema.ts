import { z } from 'zod';

export const SessionStatusEnum = z.enum([
  'pending',
  'connecting',
  'active',
  'completed',
  'failed',
  'cancelled',
]);

export type SessionStatus = z.infer<typeof SessionStatusEnum>;

const InterviewTopicSchema = z.object({
  topic: z.string(),
  objective: z.string(),
  target_time_mins: z.number().positive(),
  max_time_mins: z.number().positive(),
  priority: z.number().int().positive(),
  sub_topics: z.array(z.string()).min(1),
  guiding_questions: z.array(z.string()).optional(),
});

export const CreateSessionSchema = z.object({
  meeting_url: z.string().url(),
  interview_config: z.object({
    interview_framework: z.array(InterviewTopicSchema).min(1),
    stakeholder_context: z.object({
      name: z.string(),
      role: z.string(),
    }),
    interview_settings: z.object({
      total_max_time_mins: z.number().positive(),
      conclusion_buffer_mins: z.number().positive(),
      silence_timeout_secs: z.number().int().min(0).optional(),
    }),
    bot_identity: z.object({
      persona_name: z.string(),
    }).optional(),
    review_context: z.object({
      review_type: z.string(),
      project_name: z.string().nullable(),
    }).optional(),
  }),
  callback_url: z.string().url().optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const AgentCallbackSchema = z.object({
  session_id: z.string().uuid(),
  status: z.enum(['completed', 'failed']),
  results: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type AgentCallbackInput = z.infer<typeof AgentCallbackSchema>;

export const StopSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const CancelSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const DeleteSessionSchema = z.object({
  sessionId: z.string().uuid(),
});
