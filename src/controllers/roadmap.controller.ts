import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { progressService } from "../services/progress.service";
import dotenv from "dotenv";
import {
  GenerateRoadmapSchema,
  GetRoadmapsQuerySchema,
  RoadmapIdParamSchema,
} from "../validation/roadmap.validations";
import {
  ensureRoadmapIds,
  parseAndValidateRoadmap,
} from "../utils/json-parser";
import {
  UserContext,
  FastAPIStreamPayload,
  RoadmapData,
} from "../types/roadmap.types";
import {
  BadRequestException,
  ErrorCode,
  InternalException,
} from "../utils/root";

dotenv.config();

// Constants
const DEFAULT_FASTAPI_URL = "http://127.0.0.1:8000";
const DEFAULT_ROADMAP_LIMIT = 10;
const MAX_ROADMAP_LIMIT = 100;

/**
 * Generates a roadmap using streaming SSE from FastAPI
 * @route POST /api/roadmap/stream
 */
export async function generateRoadmapStream(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  try {
    // Parse request body first
    const {
      message,
      conversation_history = [],
      chatSessionId,
      strictMode,
    } = req.body;
    // Validate request body
    GenerateRoadmapSchema.parse(req.body); // Still validate the full body

    console.log(
      `[Roadmap-Stream] Request for: ${user.email}, chatSessionId: ${chatSessionId}`,
    );

    // Prepare headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // User context for personalization
    const userContext: UserContext = {
      user_id: user.id,
      user_name: user.name || user.email.split("@")[0],
      known_technologies: [], // Fetched below
    };

    // Get user context (original logic for knownTech)
    const knownTech = await prisma.userKnownTechnology.findMany({
      where: { userId: user.id },
      select: { technology: true },
    });
    userContext.known_technologies = knownTech.map(
      (t: { technology: string }) => t.technology,
    );

    // Validate environment variables
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    const endpoint = `${fastApiUrl}/api/v1/chat/stream`;

    console.log(`[Roadmap-Stream] Connecting to FastAPI: ${endpoint}`);

    const payload: FastAPIStreamPayload = {
      message,
      conversation_history,
      user_context: userContext,
      strict_mode: strictMode,
    };
    console.log(`[Roadmap-Stream] Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`FastAPI stream error: ${response.statusText}`);
    }

    // Pipe the stream directly to the client
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;

    let sseBuffer = "";
    let fullContent = "";
    let hasError = false; // Track if error occurred

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(
            `[Roadmap-Stream] Stream complete. Total chunks: ${chunkCount}`,
          );
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });

        // Log first few chunks for debug
        if (chunkCount <= 3) {
          console.log(
            `[Roadmap-Stream] Chunk ${chunkCount} (len=${chunk.length})`,
          );
        }

        // Accumulate chunks in buffer to handle split lines
        sseBuffer += chunk;
        const lines = sseBuffer.split("\n");
        // Keep the last partial line in the buffer
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Debug: Log first few lines to see format
          if (chunkCount <= 5) {
            console.log(
              `[Roadmap-Stream] Line ${chunkCount}:`,
              line.substring(0, 100),
            );
          }

          // Forward as SSE event to client (add data: prefix for proper SSE format)
          res.write(`data: ${line}\n\n`);

          // Process for DB saving - parse JSON directly
          try {
            const eventData = JSON.parse(line);

            if (eventData.event === "token") {
              fullContent += eventData.data;
            } else if (eventData.event === "error") {
              console.error(
                "[Roadmap-Stream] Backend reported error:",
                eventData.data,
              );
              hasError = true;
            }
          } catch (e) {
            // Ignore parse errors for DB saving, but we still sent the line to client
            if (chunkCount <= 5) {
              console.warn("[Roadmap-Stream] JSON parse error:", e);
            }
          }
        }
      }

      // Process any remaining buffer content
      if (sseBuffer.trim()) {
        const line = sseBuffer;
        res.write(`data: ${line}\n\n`);
        try {
          const eventData = JSON.parse(line);
          if (eventData.event === "token") {
            fullContent += eventData.data;
          }
        } catch (e) {
          console.warn("[Roadmap-Stream] JSON parse error (final):", e);
        }
      }

      // Stream finished, try to save
      try {
        if (hasError) {
          console.log(
            "[Roadmap-Stream] Stream ended with error. Skipping DB save.",
          );
          res.end();
          return;
        }

        console.log(
          `[Roadmap-Stream] Parsing full content (${fullContent.length} chars)`,
        );

        // Parse and validate roadmap data using utility
        const roadmapData = parseAndValidateRoadmap(fullContent);
        const roadmapDataWithIds = ensureRoadmapIds(roadmapData);
        if (roadmapData) {
          const savedRoadmap = await prisma.roadmap.create({
            data: {
              userId: user.id,
              chatSessionId,
              title: roadmapDataWithIds.goal || "Untitled Roadmap",
              goal: roadmapDataWithIds.goal,
              intent: roadmapDataWithIds.intent || "learn",
              proficiency: roadmapDataWithIds.proficiency || "beginner",
              roadmapData: roadmapDataWithIds, //save with internal ids
              message,
            },
          });

          console.log(
            `[Roadmap-Stream] Saved roadmap to DB: ${savedRoadmap.id}`,
          );

          // Emit the roadmap ID so client can link it
          res.write(
            `data: ${JSON.stringify({
              event: "roadmap_created",
              data: savedRoadmap.id,
            })}\n\n`,
          );
        } else {
          console.warn(
            "[Roadmap-Stream] ⚠️ Output validation failed (no valid phases), not saving.",
          );
        }
      } catch (parseError) {
        console.error(
          "[Roadmap-Stream] Failed to parse/save roadmap:",
          parseError,
        );
        // Do not fail the request, as stream already succeeded
      }
    } catch (streamError) {
      console.error("[Roadmap-Stream] Stream interrupted:", streamError);
    } finally {
      res.end();
    }
  } catch (error: any) {
    console.error("[Roadmap-Stream] Error:", error.message);
    // If headers sent, we can't send JSON error, send SSE error event
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ event: "error", data: error.message })}\n\n`,
      );
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * Get user's roadmaps
 * @route GET /api/roadmap
 */
export async function getUserRoadmaps(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  // Validate query parameters
  const validatedQuery = GetRoadmapsQuerySchema.parse(req.query);
  const limit = Math.min(validatedQuery.limit, MAX_ROADMAP_LIMIT);
  const { isSelected, chatSessionId } = validatedQuery;

  const where: any = { userId: user.id };
  if (isSelected !== undefined) {
    where.isSelected = isSelected;
  }
  if (chatSessionId) {
    where.chatSessionId = chatSessionId;
  }

  try {
    const roadmaps = await prisma.roadmap.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        goal: true,
        proficiency: true,
        createdAt: true,
        isSelected: true,
      },
    });

    res.json(roadmaps);
  } catch (error: any) {
    console.error("[Roadmap] Error fetching roadmaps:", error);
    res.status(500).json({ error: "Failed to fetch roadmaps" });
  }
}

/**
 * Get roadmap by ID
 * @route GET /api/roadmap/:id
 */
export async function getRoadmapById(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  // Validate roadmap ID parameter
  const validatedParams = RoadmapIdParamSchema.parse(req.params);
  const { id } = validatedParams;

  try {
    const roadmap = await prisma.roadmap.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!roadmap) {
      return res.status(404).json({ error: "Roadmap not found" });
    }

    res.json(roadmap);
  } catch (error: any) {
    console.error("[Roadmap] Error fetching roadmap:", error);
    res.status(500).json({ error: "Failed to fetch roadmap" });
  }
}

/**
 * Health check endpoint - verifies FastAPI connectivity
 * @route GET /api/roadmap/health
 */
export async function healthCheck(req: Request, res: Response) {
  try {
    const fastApiUrl = process.env.FASTAPI_URL;
    if (!fastApiUrl) {
      throw new InternalException(
        "FastAPI URL not configured",
        ErrorCode.INTERNAL_EXCEPTION,
      );
    }

    const response = await fetch(`${fastApiUrl}/health`);

    if (response.ok) {
      const data = await response.json();
      res.json({
        status: "ok",
        backend: "healthy",
        fastapi: data.status || "healthy",
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "degraded",
        backend: "healthy",
        fastapi: "unhealthy",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: "error",
      backend: "healthy",
      fastapi: "unreachable",
      error: "FastAPI is not responding",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Trigger document ingestion in FastAPI
 * @route POST /api/roadmap/ingest
 */
export async function ingestDocument(req: Request, res: Response) {
  try {
    const fastApiUrl = process.env.FASTAPI_URL;

    if (!fastApiUrl) {
      throw new InternalException(
        "FastAPI URL not configured",
        ErrorCode.INTERNAL_EXCEPTION,
      );
    }

    const response = await fetch(`${fastApiUrl}/api/v1/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("[Ingest] Error:", error.message);
    res.status(500).json({
      detail: "Failed to trigger document ingestion",
      error: error.message,
    });
  }
}
/**
 * Select a roadmap as the user's active roadmap
 * @route POST /api/roadmap/:id/select
 */
export async function selectRoadmap(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  const { id } = RoadmapIdParamSchema.parse(req.params);

  try {
    const roadmap = await prisma.roadmap.findFirst({
      where: { id, userId: user.id },
    });

    if (!roadmap) {
      return res.status(404).json({ error: "Roadmap not found" });
    }

    // Removed single-active constraint as per user request
    // Allow multiple roadmaps to be selected simultaneously

    const selectedRoadmap = await prisma.roadmap.update({
      where: { id },
      data: { isSelected: true },
    });

    // Initialize progress tracking when selected
    await progressService.initializeProgress(id, user.id);

    res.json({
      success: true,
      data: selectedRoadmap,
    });
  } catch (error: any) {
    console.error("[Roadmap] Error selecting roadmap:", error);
    res.status(500).json({ error: "Failed to select roadmap" });
  }
}
