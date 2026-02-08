import { z } from "zod";

/**
 * Validation schemas for topic endpoints
 */

export const TopicDetailParamsSchema = z.object({
  topicId: z.string().min(1, "Topic ID is required"),
  phaseId: z.string().min(1, "Phase ID is required"),
});

export const TopicDetailQuerySchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  roadmapId: z.string().uuid("Invalid roadmap ID").optional(),
});

export type TopicDetailParams = z.infer<typeof TopicDetailParamsSchema>;
export type TopicDetailQuery = z.infer<typeof TopicDetailQuerySchema>;
