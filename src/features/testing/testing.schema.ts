import { z } from 'zod';

export const IntervieweeProfileSchema = z.object({
  personality: z.string().min(1),
  expertise: z.object({
    strong: z.array(z.string()),
    weak: z.array(z.string()),
  }),
  instructions: z.string().min(1),
});

export const UpdateTestModeSchema = z.object({
  enabled: z.boolean(),
  intervieweeProfile: IntervieweeProfileSchema.nullable(),
});

export type IntervieweeProfileInput = z.infer<typeof IntervieweeProfileSchema>;
export type UpdateTestModeInput = z.infer<typeof UpdateTestModeSchema>;
