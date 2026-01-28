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
    // Validate path parameters
    const validatedParams = TopicDetailParamsSchema.parse(req.params);
    const { phaseNumber, topicTitle } = validatedParams;

    // Validate query parameters
    const validatedQuery = TopicDetailQuerySchema.parse(req.query);
    const { phaseTitle, goal, roadmapId } = validatedQuery;

    console.log(
      `[Topic] Fetching detail for: ${topicTitle} (Phase ${phaseNumber})`,
    );

    // Check if we have cached content in database
    if (roadmapId) {
      const cachedContent = await prisma.topicContent.findUnique({
        where: {
          roadmapId_phaseNumber_topicTitle: {
            roadmapId,
            phaseNumber,
            topicTitle,
          },
        },
      });

      if (cachedContent) {
        console.log(`[Topic] ✅ Returning cached content from database`);
        return res.json(cachedContent.content);
      }
    }

    // No cache found, fetch from Bato-Ai
    console.log(`[Topic] 🔄 Fetching from Bato-Ai (not cached)`);

    // Get FastAPI URL
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;

    // Construct FastAPI endpoint URL
    const endpoint = `${fastApiUrl}/api/v1/topic/${phaseNumber}/${encodeURIComponent(topicTitle)}?phase_title=${encodeURIComponent(phaseTitle)}&goal=${encodeURIComponent(goal)}`;

    console.log(`[Topic] Calling FastAPI: ${endpoint}`);

    // Forward request to FastAPI
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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
        await prisma.topicContent.create({
          data: {
            roadmapId,
            topicTitle,
            phaseNumber,
            phaseTitle,
            content: topicDetail,
          },
        });
        console.log(`[Topic] 💾 Cached content in database`);
      } catch (cacheError) {
        // If caching fails (e.g., duplicate), just log and continue
        console.warn(`[Topic] ⚠️ Failed to cache content:`, cacheError);
      }
    }

    console.log(`[Topic] ✅ Successfully fetched topic detail`);

    res.json(topicDetail);
  } catch (error: any) {
    console.error("[Topic] Error fetching topic detail:", error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors,
      });
    }

    res.status(500).json({
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
    // Validate path parameters
    const validatedParams = TopicDetailParamsSchema.parse(req.params);
    const { phaseNumber, topicTitle } = validatedParams;

    // Validate query parameters
    const validatedQuery = TopicDetailQuerySchema.parse(req.query);
    const { phaseTitle, goal, roadmapId } = validatedQuery;

    console.log(
      `[Topic Stream] Starting stream for: ${topicTitle} (Phase ${phaseNumber})`,
    );

    // Check if we have cached content in database
    if (roadmapId) {
      const cachedContent = await prisma.topicContent.findUnique({
        where: {
          roadmapId_phaseNumber_topicTitle: {
            roadmapId,
            phaseNumber,
            topicTitle,
          },
        },
      });

      if (cachedContent) {
        console.log(`[Topic Stream] ✅ Returning cached content immediately`);
        // Send as a single SSE event
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify(cachedContent.content)}\n\n`);
        return res.end();
      }
    }

    // No cache found, stream from Bato-Ai
    console.log(`[Topic Stream] 🔄 Streaming from Bato-Ai`);

    // Get FastAPI URL
    const fastApiUrl = process.env.FASTAPI_URL || DEFAULT_FASTAPI_URL;
    const endpoint = `${fastApiUrl}/api/v1/topic/stream/${phaseNumber}/${encodeURIComponent(topicTitle)}?phase_title=${encodeURIComponent(phaseTitle)}&goal=${encodeURIComponent(goal)}`;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Fetch from FastAPI with response streaming
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`FastAPI stream failed: ${response.statusText}`);
    }

    // Accumulate chunks for caching
    let fullResponse = "";

    // Pipe stream to client and accumulate
    // @ts-ignore
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // Allow passing through raw chunks to frontend (frontend must handle partial JSON)
      res.write(chunk);
    }

    res.end();

    // After stream ends, try to parse and cache
    if (roadmapId) {
      try {
        // Clean up SSE format "data: ...\n\n" if present
        // Actually the raw stream from python is just chunks, but if Python wraps in SSE we need to parse
        // Our Python implementation yielded raw content, but wrapped in StreamingResponse(media_type="text/event-stream")
        // Uvicorn might wrap it. Let's assume for now we need to robustly parse the accumulated string.

        // Note: We need to be careful here. The chunks might be raw text.
        // Let's attempt to repair/parse the accumulated JSON string
        // We might need a utility here or just trust the full string is valid JSON

        // Note: The stream from Python yields raw chunks of the JSON.
        // However, there might be markdown wrappers (```json ... ```) or other artifacts
        // if the model didn't follow instructions perfectly.

        let jsonContent;
        try {
          // Use robust parser with strict TopicDetail validation
          const { parseAndValidateTopicDetail } =
            await import("../utils/json-parser");
          const parsed = parseAndValidateTopicDetail(fullResponse);

          if (!parsed) {
            console.warn(
              `[Topic Stream] ⚠️ JSON valid but schema validation failed`,
            );
            return; // Don't cache invalid schema
          }
          jsonContent = parsed;
        } catch (e: any) {
          console.warn(`[Topic Stream] ⚠️ JSON parse failed: ${e.message}`);
          console.warn(
            `[Topic Stream] ❌ JSON content start: ${fullResponse.substring(0, 100)}...`,
          );
          return;
        }

        await prisma.topicContent.create({
          data: {
            roadmapId,
            topicTitle,
            phaseNumber,
            phaseTitle,
            content: jsonContent as any,
          },
        });
        console.log(`[Topic Stream] 💾 Cached complete content in database`);
      } catch (cacheError) {
        console.warn(
          `[Topic Stream] ⚠️ Failed to cache streamed content:`,
          cacheError,
        );
      }
    }
  } catch (error: any) {
    console.error("[Topic Stream] Error:", error);
    // If headers already sent, we can't send error status
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end(); // close stream
    }
  }
}
