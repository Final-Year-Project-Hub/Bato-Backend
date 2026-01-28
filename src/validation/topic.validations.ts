import { z } from "zod";

/**
 * Validation schemas for topic endpoints
 */

export const TopicDetailParamsSchema = z.object({
  phaseNumber: z
    .string()
    .regex(/^\d+$/, "Phase number must be a valid integer")
    .transform(Number),
  topicTitle: z.string().min(1, "Topic title is required"),
});

export const TopicDetailQuerySchema = z.object({
  phaseTitle: z.string().min(1, "Phase title is required"),
  goal: z.string().min(1, "Goal is required"),
  roadmapId: z.string().uuid("Invalid roadmap ID").optional(),
});

export type TopicDetailParams = z.infer<typeof TopicDetailParamsSchema>;
export type TopicDetailQuery = z.infer<typeof TopicDetailQuerySchema>;
