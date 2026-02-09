import { z } from "zod";

export const RoadmapIdParamsSchema = z.object({
  roadmapId: z.string().uuid("Invalid roadmapId"),
});

export const ViewTopicSchema = z.object({
  phaseId: z.string().uuid("Invalid phaseId"),
  topicId: z.string().uuid("Invalid topicId"),
});

export const CompleteTopicSchema = z.object({
  phaseId: z.string().uuid("Invalid phaseId"),
  topicId: z.string().uuid("Invalid topicId"),
});

export const CompletePhaseQuizSchema = z.object({
  phaseId: z.string().uuid("Invalid phaseId"),
  passed: z.boolean(),
});

export const UpdateTimeSpentSchema = z.object({
  timeSpent: z.number().min(0),
});
