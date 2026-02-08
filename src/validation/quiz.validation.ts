import { z } from "zod";

// Submit quiz attempt validation
export const submitQuizSchema = z.object({
  topicContentId: z.string().uuid(),
  answers: z.record(z.number(), z.string().regex(/^[A-D]$/)),
  timeSpent: z.number().int().positive().optional(),
});

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
