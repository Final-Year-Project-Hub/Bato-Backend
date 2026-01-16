import { z } from "zod";

// Existing schemas
export const GenerateRoadmapSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversation_history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  chatSessionId: z.string().uuid().optional(), // Link to chat session
  strictMode: z.boolean().optional(),
});

export const GetRoadmapsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(10),
  chatSessionId: z.string().uuid().optional(), // Filter by chat session
  isSelected: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export const RoadmapIdParamSchema = z.object({
  id: z.string().uuid("Invalid roadmap ID"),
});

// New schemas for roadmap management
export const SelectRoadmapSchema = z.object({
  userId: z.string().uuid(),
});

export const UpdateRoadmapSchema = z.object({
  title: z.string().min(1).optional(),
  isSelected: z.boolean().optional(),
});
