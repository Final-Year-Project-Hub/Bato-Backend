import { Request, Response } from "express";
import { chatService } from "../services/chat.service";

export class ChatController {
  /**
   * Create a new chat session
   * POST /api/v1/chats
   */
  async createChatSession(req: Request, res: Response) {
    try {
      const { userId, initialMessage } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const chatSession = await chatService.createChatSession(
        userId,
        initialMessage,
      );

      res.status(201).json({
        success: true,
        data: chatSession,
      });
    } catch (error: any) {
      console.error("[ChatController] Error creating chat session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create chat session",
      });
    }
  }

  /**
   * Get all chat sessions for a user
   * GET /api/v1/chats?userId={userId}
   */
  async getChatSessions(req: Request, res: Response) {
    try {
      const { userId } = req.query;

      if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "userId is required" });
      }

      const chatSessions = await chatService.getChatSessions(userId);

      res.status(200).json({
        success: true,
        data: chatSessions,
      });
    } catch (error: any) {
      console.error("[ChatController] Error getting chat sessions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get chat sessions",
      });
    }
  }

  /**
   * Get a single chat session
   * GET /api/v1/chats/:chatId
   */
  async getChatSession(req: Request, res: Response) {
    try {
      const chatId = req.params.chatId as string;

      const chatSession = await chatService.getChatSession(chatId);

      if (!chatSession) {
        return res.status(404).json({ error: "Chat session not found" });
      }

      res.status(200).json({
        success: true,
        data: chatSession,
      });
    } catch (error: any) {
      console.error("[ChatController] Error getting chat session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get chat session",
      });
    }
  }

  /**
   * Get messages for a chat session
   * GET /api/v1/chats/:chatId/messages
   */
  async getChatMessages(req: Request, res: Response) {
    try {
      const chatId = req.params.chatId as string;

      const messages = await chatService.getChatMessages(chatId);

      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      console.error("[ChatController] Error getting chat messages:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get chat messages",
      });
    }
  }

  /**
   * Add a message to a chat session
   * POST /api/v1/chats/:chatId/messages
   */
  async addMessage(req: Request, res: Response) {
    try {
      const chatId = req.params.chatId as string;
      const { role, content, roadmapId } = req.body;

      if (!role || !content) {
        return res.status(400).json({ error: "role and content are required" });
      }

      if (role !== "user" && role !== "assistant") {
        return res
          .status(400)
          .json({ error: 'role must be "user" or "assistant"' });
      }

      const message = await chatService.addMessage(
        chatId,
        role,
        content,
        roadmapId,
      );

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      console.error("[ChatController] Error adding message:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to add message",
      });
    }
  }

  /**
   * Delete a chat session
   * DELETE /api/v1/chats/:chatId
   */
  async deleteChatSession(req: Request, res: Response) {
    try {
      const chatId = req.params.chatId as string;

      await chatService.deleteChatSession(chatId);

      res.status(200).json({
        success: true,
        message: "Chat session deleted successfully",
      });
    } catch (error: any) {
      console.error("[ChatController] Error deleting chat session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete chat session",
      });
    }
  }

  /**
   * Update chat session title
   * PATCH /api/v1/chats/:chatId
   */
  async updateChatTitle(req: Request, res: Response) {
    try {
      const chatId = req.params.chatId as string;
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      const chatSession = await chatService.updateChatTitle(chatId, title);

      res.status(200).json({
        success: true,
        data: chatSession,
      });
    } catch (error: any) {
      console.error("[ChatController] Error updating chat title:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update chat title",
      });
    }
  }
}

export const chatController = new ChatController();
