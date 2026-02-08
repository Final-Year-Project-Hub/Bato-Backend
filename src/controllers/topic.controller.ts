import { Request, Response } from "express";
import dotenv from "dotenv";
import {
  TopicDetailParamsSchema,
  TopicDetailQuerySchema,
} from "../validation/topic.validations";
import {
  BadRequestException,
  ErrorCode,
  InternalException,
} from "../utils/root";
import { prisma } from "../lib/prisma";

dotenv.config();

const DEFAULT_FASTAPI_URL = "http://127.0.0.1:8000";

/**
 * Get detailed topic content (deep-dive)
 * @route GET /api/topic/:phaseNumber/:topicTitle
 */
export async function getTopicDetail(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  try {
    const { phaseId, topicId } = TopicDetailParamsSchema.parse(req.params);
    const { goal, roadmapId } = TopicDetailQuerySchema.parse(req.query);
    // Fetch roadmap data to extract phaseNumber and topicTitle
    const roadmap = await prisma.roadmap.findUnique({
      where: {
        id: roadmapId,
      },
      select: {
        roadmapData: true,
      },
    });

    // Extract phaseNumber, topicTitle, and phaseTitle from roadmapData JSON
    let phaseNumber = 0;
    let topicTitle = "Unknown Topic";
    let phaseTitle = "Unknown Phase";

    if (roadmap?.roadmapData) {
      const roadmapData = roadmap.roadmapData as any;
      const phases = roadmapData.phases || [];

      // Find the phase and topic by their IDs
      const phase = phases.find((p: any) => p.id === phaseId);
      if (phase) {
        phaseNumber = phase.phase_number || 0;
        phaseTitle = phase.title || "Unknown Phase";
        const topic = phase.topics?.find((t: any) => t.id === topicId);
        if (topic) {
          topicTitle = topic.title || "Unknown Topic";
        }
      }
    }

    console.log(
      `[Topic] Fetching detail for: ${topicTitle} (Phase ${phaseNumber})`,
    );
    console.log(
      `[Topic] Fetching detail for topicId=${topicId}, phaseId=${phaseId}`,
    );

    // ✅ 1) Cache lookup by IDs
    let cachedContent = null;
    if (roadmapId) {
      cachedContent = await prisma.topicContent.findUnique({
        where: {
          roadmapId_phaseId_topicId: {
            roadmapId,
            phaseId,
            topicId,
          },
        },
      });
    }

    if (cachedContent) {
      console.log(`[Topic] ✅ Returning cached content from database`);
      return res.json(cachedContent.content);
    }

    console.log(`[Topic] Fetching from FastAPI (not cached)`);

    // ✅ 2) Call FastAPI using IDs (you must implement this endpoint in FastAPI)
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    // Example ID-based endpoint:
    // GET /api/v1/topic/{phaseId}/{topicId}?goal=...
    // const endpoint =
    //   `${fastApiUrl}/api/v1/topic/${phaseId}/${topicId}` +
    //   `?goal=${encodeURIComponent(goal)}`;

    const endpoint = `${fastApiUrl}/api/v1/topic/${phaseNumber}/${encodeURIComponent(topicTitle)}?phase_title=${encodeURIComponent(phaseTitle)}&goal=${encodeURIComponent(goal)}`;

    console.log(`[Topic] Calling FastAPI: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        detail: response.statusText,
      }));
      console.error(`[Topic] FastAPI error:`, errorData);

      return res.status(response.status).json({
        error: errorData.detail || "Failed to fetch topic detail",
      });
    }

    const topicDetail = await response.json();

    // Cache the content in database if roadmapId is provided
    if (roadmapId) {
      try {
        const createdContent = await prisma.topicContent.create({
          data: {
            roadmapId,
            phaseId,
            topicId,
            topicTitle: topicDetail.title || "Untitled Topic",
            phaseNumber: topicDetail.phase_number || 0,
            phaseTitle: topicDetail.phase_title || "Untitled Phase",
            content: topicDetail as any,
          },
        });
        console.log(
          `[Topic] 💾 Cached content in database with ID: ${createdContent.id}`,
        );
      } catch (cacheError) {
        // If caching fails (e.g., duplicate), just log and continue
        console.warn(`[Topic] ⚠️ Failed to cache content:`, cacheError);
      }
    }

    console.log(`[Topic] ✅ Successfully fetched topic detail`);

    res.json(topicDetail);
  } catch (error: any) {
    console.error("[Topic] Error fetching topic detail:", error);

    if (error?.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: error.message || "Failed to fetch topic detail",
    });
  }
}

/**
 * Stream detailed topic content (Server-Sent Events)
 * @route GET /api/topic/stream/:phaseNumber/:topicTitle
 */
export async function getTopicStream(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    throw new BadRequestException(
      "User not authenticated",
      ErrorCode.UNAUTHORIZED_REQUEST,
    );
  }

  try {
    const { phaseId, topicId } = TopicDetailParamsSchema.parse(req.params);
    const { goal, roadmapId } = TopicDetailQuerySchema.parse(req.query);

    console.log(
      `[Topic Stream] Starting stream for topicId=${topicId}, phaseId=${phaseId}`,
    );

    // ✅ SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // ✅ 1) Cache lookup by IDs
    let cachedContent = null;
    if (roadmapId) {
      cachedContent = await prisma.topicContent.findUnique({
        where: {
          roadmapId_phaseId_topicId: {
            roadmapId,
            phaseId,
            topicId,
          },
        },
      });
    }

    if (cachedContent) {
      console.log(`[Topic Stream] ✅ Returning cached content immediately`);
      // Send as a single SSE event
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify(cachedContent.content)}\n\n`);
      return res.end();
    }

    console.log(`[Topic Stream] Streaming from FastAPI (not cached)`);

    // Extract phaseNumber, topicTitle, and phaseTitle from roadmapData
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      select: { roadmapData: true },
    });

    let phaseNumber = 0;
    let topicTitle = "Unknown Topic";
    let phaseTitle = "Unknown Phase";

    if (roadmap?.roadmapData) {
      const roadmapData = roadmap.roadmapData as any;
      const phases = roadmapData.phases || [];

      const phase = phases.find((p: any) => p.id === phaseId);
      if (phase) {
        phaseNumber = phase.phase_number || 0;
        phaseTitle = phase.title || "Unknown Phase";
        const topic = phase.topics?.find((t: any) => t.id === topicId);
        if (topic) {
          topicTitle = topic.title || "Unknown Topic";
        }
      }
    }

    // ✅ 2) Call FastAPI stream using extracted values
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    const endpoint = `${fastApiUrl}/api/v1/topic/stream/${phaseNumber}/${encodeURIComponent(topicTitle)}?phase_title=${encodeURIComponent(phaseTitle)}&goal=${encodeURIComponent(goal)}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok || !response.body) {
      throw new Error(`FastAPI stream failed: ${response.statusText}`);
    }

    let fullResponse = "";

    // @ts-ignore
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // pass-through stream to client
      res.write(chunk);
    }

    res.end();

    // ✅ 3) Parse and cache after stream ends
    try {
      const { parseAndValidateTopicDetail } =
        await import("../utils/json-parser");
      const parsed = parseAndValidateTopicDetail(fullResponse);

      if (!parsed) {
        console.warn(
          `[Topic Stream] ⚠️ Parsed JSON but schema validation failed — not caching`,
        );
        return;
      }

      if (roadmapId) {
        // Extract phaseNumber, topicTitle, and phaseTitle from roadmapData
        const roadmap = await prisma.roadmap.findUnique({
          where: { id: roadmapId },
          select: { roadmapData: true },
        });

        let phaseNumber = parsed.phase_number || 0;
        let topicTitle = parsed.title || "Unknown Topic";
        let phaseTitle = parsed.phase_title || "Unknown Phase";

        // Try to get more accurate data from roadmapData if available
        if (roadmap?.roadmapData) {
          const roadmapData = roadmap.roadmapData as any;
          const phases = roadmapData.phases || [];
          const phase = phases.find((p: any) => p.id === phaseId);
          if (phase) {
            phaseNumber = phase.phase_number || phaseNumber;
            phaseTitle = phase.title || phaseTitle;
            const topic = phase.topics?.find((t: any) => t.id === topicId);
            if (topic) {
              topicTitle = topic.title || topicTitle;
            }
          }
        }

        await prisma.topicContent.create({
          data: {
            roadmapId,
            phaseId,
            topicId,
            topicTitle,
            phaseNumber,
            phaseTitle,
            content: parsed as any,
          },
        });
        console.log(`[Topic Stream] 💾 Cached complete streamed content`);
      }
    } catch (cacheError) {
      console.warn(
        `[Topic Stream] ⚠️ Failed to parse/cache streamed content:`,
        cacheError,
      );
    }
  } catch (error: any) {
    console.error("[Topic Stream] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    return res.end();
  }
}
