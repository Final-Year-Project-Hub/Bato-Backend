import { z } from "zod";

/**
 * Schema for updating progress
 */
export const UpdateProgressSchema = z.object({
  completedPhases: z.array(z.number().int().nonnegative()).optional(),
  completedTopics: z.array(z.string()).optional(),
  currentPhase: z.number().int().nonnegative().optional(),
  currentTopic: z.string().optional(),
  timeSpent: z.number().nonnegative().optional(),
});

/**
 * Schema for completing a phase
 */
export const CompletePhaseSchema = z.object({
  phaseIndex: z
    .number()
    .int()
    .nonnegative("Phase index must be a non-negative integer"),
});

/**
 * Schema for completing a topic
 */
export const CompleteTopicSchema = z.object({
  topicPath: z.string().min(1, "Topic path is required"),
});

/**
 * Schema for roadmap ID parameter
 */
export const RoadmapIdParamSchema = z.object({
  roadmapId: z.string().uuid("Invalid roadmap ID"),
});
