export interface IntervieweeProfile {
  personality: string;
  expertise: { strong: string[]; weak: string[] };
  instructions: string;
}

export const DEFAULT_INTERVIEWEE_PROFILE: IntervieweeProfile = {
  personality: 'Cooperative, gives substantive 2-4 sentence answers',
  expertise: { strong: [], weak: [] },
  instructions: 'Answer honestly and substantively.',
};
