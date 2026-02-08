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

    console.log(`[Topic] Fetching detail for topicId=${topicId}, phaseId=${phaseId}`);

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
      console.log(`[Topic] ✅ Returning cached content`);
      return res.json(cachedContent.content);
    }

    console.log(`[Topic] Fetching from FastAPI (not cached)`);

    // ✅ 2) Call FastAPI using IDs (you must implement this endpoint in FastAPI)
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    // Example ID-based endpoint:
    // GET /api/v1/topic/{phaseId}/{topicId}?goal=...
    const endpoint =
      `${fastApiUrl}/api/v1/topic/${phaseId}/${topicId}` +
      `?goal=${encodeURIComponent(goal)}`;

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

    // ✅ 3) Cache by IDs
    let newContent;
    if (roadmapId) {
      try {
        newContent = await prisma.topicContent.create({
          data: {
            roadmapId,
            phaseId,
            topicId,
            topicTitle: topicDetail.title,
            phaseNumber: topicDetail.phase_number,
            phaseTitle: topicDetail.phase_title,
            content: topicDetail,
          },
        });
        console.log(`[Topic] 💾 Cached content in database`);
      } catch (cacheError) {
        // ignore duplicates - try to fetch existing if create failed
        console.warn(`[Topic] ⚠️ Failed to cache content (might already exist):`, cacheError);
        newContent = await prisma.topicContent.findUnique({
          where: {
            roadmapId_phaseId_topicId: {
              roadmapId,
              phaseId,
              topicId,
            },
          },
        });
      }
    }


    // ... (cache creation logic remains) ...
    // Revert to returning only the inner content
    return res.json(topicDetail);
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

    console.log(`[Topic Stream] Starting stream for topicId=${topicId}, phaseId=${phaseId}`);

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
      res.write(`data: ${JSON.stringify(cachedContent.content)}\n\n`);
      return res.end();
    }

    console.log(`[Topic Stream] Streaming from FastAPI (not cached)`);

    // ✅ 2) Call FastAPI stream using IDs (you must implement this endpoint in FastAPI)
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    // Example stream endpoint:
    // GET /api/v1/topic/stream/{phaseId}/{topicId}?goal=...
    const endpoint =
      `${fastApiUrl}/api/v1/topic/stream/${phaseId}/${topicId}` +
      `?goal=${encodeURIComponent(goal)}`;

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
      const { parseAndValidateTopicDetail } = await import("../utils/json-parser");
      const parsed = parseAndValidateTopicDetail(fullResponse);

      if (!parsed) {
        console.warn(`[Topic Stream] ⚠️ Parsed JSON but schema validation failed — not caching`);
        return;
      }

      if (roadmapId) {
        await prisma.topicContent.create({
          data: {
            roadmapId,
            phaseId,
            topicId,
            topicTitle: parsed.title,
            phaseNumber: parsed.phase_number,
            phaseTitle: parsed.phase_title,
            content: parsed as any,
          },
        });
        console.log(`[Topic Stream] 💾 Cached complete streamed content`);
      }


    } catch (cacheError) {
      console.warn(`[Topic Stream] ⚠️ Failed to parse/cache streamed content:`, cacheError);
    }
  } catch (error: any) {
    console.error("[Topic Stream] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    return res.end();
  }
}