import { prisma } from "../lib/prisma.js";

export class ChatService {
  /**
   * Create a new chat session for a user
   */
  async createChatSession(
    userId: string,
    initialMessage?: string
  ): Promise<any> {
    const title = initialMessage
      ? await this.generateChatTitle(initialMessage)
      : "New Chat";

    console.log("[ChatService] Creating chat session for user:", userId);

    // Create the chat session first
    const chatSession = await prisma.chatSession.create({
      data: {
        userId,
        title,
      },
    });

    console.log("[ChatService] Chat session created:", chatSession.id);

    // If there's an initial message, add it and return updated session
    if (initialMessage) {
      console.log(
        "[ChatService] Adding initial message to chat:",
        chatSession.id
      );
      await this.addMessage(chatSession.id, "user", initialMessage);

      // Refetch with messages included
      const updatedSession = await prisma.chatSession.findUnique({
        where: { id: chatSession.id },
        include: {
          messages: true,
          roadmaps: true,
        },
      });

      console.log(
        "[ChatService] Returning updated session:",
        updatedSession?.id
      );
      return updatedSession;
    }

    // Return session with empty messages/roadmaps
    console.log("[ChatService] Returning new session:", chatSession.id);
    return {
      ...chatSession,
      messages: [],
      roadmaps: [],
    };
  }

  /**
   * Get all chat sessions for a user
   */
  async getChatSessions(userId: string): Promise<any[]> {
    const chatSessions = await prisma.chatSession.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get last message for preview
        },
        roadmaps: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Format response with last message and roadmap count
    return chatSessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastMessage: session.messages[0]?.content || null,
      roadmapCount: session.roadmaps.length,
    }));
  }

  /**
   * Get a single chat session
   */
  async getChatSession(chatSessionId: string): Promise<any> {
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      include: {
        _count: {
          select: { messages: true, roadmaps: true },
        },
      },
    });

    if (!chatSession) return null;

    return {
      id: chatSession.id,
      title: chatSession.title,
      createdAt: chatSession.createdAt,
      updatedAt: chatSession.updatedAt,
      messageCount: chatSession._count.messages,
      roadmapCount: chatSession._count.roadmaps,
    };
  }

  /**
   * Get all messages in a chat session
   */
  async getChatMessages(chatSessionId: string): Promise<any[]> {
    const messages = await prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: "asc" },
      include: {
        roadmap: {
          select: {
            id: true,
            title: true,
            goal: true,
          },
        },
      },
    });

    return messages;
  }

  /**
   * Add a message to a chat session
   */
  async addMessage(
    chatSessionId: string,
    role: "user" | "assistant",
    content: string,
    roadmapId?: string
  ): Promise<any> {
    const message = await prisma.message.create({
      data: {
        chatSessionId,
        role,
        content,
        roadmapId,
      },
      include: {
        roadmap: {
          select: {
            id: true,
            title: true,
            goal: true,
          },
        },
      },
    });

    // Update chat session's updatedAt
    await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Generate a chat title from the first message
   */
  async generateChatTitle(firstMessage: string): Promise<string> {
    // Simple title generation - take first 50 chars or extract goal
    const title =
      firstMessage.length > 50
        ? firstMessage.substring(0, 50) + "..."
        : firstMessage;

    // Try to extract intent (e.g., "learn React" -> "Learn React")
    const learnMatch = firstMessage.match(/learn\s+(\w+)/i);
    if (learnMatch) {
      return `Learn ${learnMatch[1]}`;
    }

    const buildMatch = firstMessage.match(
      /build\s+(.+?)(?:\s+with|\s+using|$)/i
    );
    if (buildMatch) {
      return `Build ${buildMatch[1]}`;
    }

    return title;
  }

  /**
   * Delete a chat session
   */
  async deleteChatSession(chatSessionId: string): Promise<void> {
    await prisma.chatSession.delete({
      where: { id: chatSessionId },
    });
  }

  /**
   * Update chat session title
   */
  async updateChatTitle(chatSessionId: string, title: string): Promise<any> {
    return await prisma.chatSession.update({
      where: { id: chatSessionId },
      data: { title },
    });
  }
}

export const chatService = new ChatService();
