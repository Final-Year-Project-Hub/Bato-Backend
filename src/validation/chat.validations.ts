import { z } from "zod";

/**
 * Schema for creating a new chat session
 */
export const CreateChatSessionSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  initialMessage: z.string().min(1).max(5000).optional(),
});

/**
 * Schema for adding a message to a chat session
 */
export const AddMessageSchema = z.object({
  role: z.enum(["user", "assistant"], {
    message: 'Role must be "user" or "assistant"',
  }),
  content: z.string().min(1, "Message content is required").max(10000),
  roadmapId: z.string().uuid("Invalid roadmap ID").optional(),
});

/**
 * Schema for updating chat title
 */
export const UpdateChatTitleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

/**
 * Schema for chat ID parameter
 */
export const ChatIdParamSchema = z.object({
  chatId: z.string().uuid("Invalid chat ID"),
});

/**
 * Schema for get chat sessions query
 */
export const GetChatSessionsQuerySchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});
