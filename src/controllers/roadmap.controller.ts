import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import dotenv from "dotenv";
dotenv.config();

export async function generateRoadmapStream(req: Request, res: Response) {
  const { message, conversation_history } = req.body;
  const user = (req as any).user;

  try {
    console.log(`[Roadmap-Stream] Request for: ${user.email}`);

    // Prepare headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Get user context (reused logic)
    const knownTech = await prisma.userKnownTechnology.findMany({
      where: { userId: user.id },
      select: { technology: true },
    });

    // Minimal user context for stream
    const userContext = {
      user_id: user.id,
      user_name: user.fullName || user.email.split("@")[0],
      known_technologies: knownTech.map((t) => t.technology),
    };

    // Call FastAPI Stream Endpoint
    const fastApiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const endpoint = `${fastApiUrl}/api/v1/chat/stream`;

    console.log(`[Roadmap-Stream] Connecting to FastAPI: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_history: conversation_history || [],
        user_context: userContext,
      }),
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(
            `[Roadmap-Stream] Stream complete. Total chunks: ${chunkCount}`
          );
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        // Log first few chunks to verify content
        if (chunkCount <= 3) {
          console.log(
            `[Roadmap-Stream] Chunk ${chunkCount}:`,
            chunk.substring(0, 50)
          );
        }
        res.write(chunk);

        // Accumulate tokens for saving
        sseBuffer += chunk;
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const eventData = JSON.parse(line);
            if (eventData.event === "token") {
              fullContent += eventData.data;
            }
          } catch (e) {
            // Ignore parse errors for partial/interleaved lines
          }
        }
      }

      // Stream finished, try to save
      try {
        console.log(
          `[Roadmap-Stream] Parsing full content (${fullContent.length} chars)`
        );

        // Helper to attempt JSON repair
        const tryParseJSON = (str: string) => {
          try {
            return JSON.parse(str);
          } catch (e) {
            // Attempt 2: Find last closing brace
            const lastBrace = str.lastIndexOf("}");
            if (lastBrace !== -1) {
              const truncated = str.substring(0, lastBrace + 1);
              try {
                return JSON.parse(truncated);
              } catch (e2) {
                // Attempt 3: Aggressive trailing commas removal
                // Remove trailing commas before closing braces/brackets
                const noTrailing = truncated
                  .replace(/,(\s*[}\]])/g, "$1")
                  .replace(/,(\s*)$/, "$1"); // End of string comma
                try {
                  return JSON.parse(noTrailing);
                } catch (e3) {
                  // Last resort: just try parsing the original without trailing commas
                  const noTrailingOrig = str
                    .replace(/,(\s*[}\]])/g, "$1")
                    .replace(/,(\s*)$/, "$1");
                  return JSON.parse(noTrailingOrig);
                }
              }
            }
            throw e;
          }
        };

        // Clean Markdown if present
        let jsonStr = fullContent.trim();
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

        const roadmapData = tryParseJSON(jsonStr.trim());

        if (roadmapData.phases && Array.isArray(roadmapData.phases)) {
          const savedRoadmap = await prisma.roadmap.create({
            data: {
              userId: user.id,
              title: roadmapData.goal || "Untitled Roadmap",
              goal: roadmapData.goal,
              proficiency: roadmapData.proficiency || "beginner",
              roadmapData: roadmapData,
              message: message,
            },
          });
          console.log(
            `[Roadmap-Stream] ✅ Saved roadmap to DB: ${savedRoadmap.id}`
          );
        } else {
          console.log(
            "[Roadmap-Stream] ⚠️ Output validation failed (no phases), not saving."
          );
        }
      } catch (parseError) {
        console.error(
          "[Roadmap-Stream] Failed to parse/save roadmap:",
          parseError
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
        `data: ${JSON.stringify({ event: "error", data: error.message })}\n\n`
      );
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}

/**
 * Get user's roadmaps
 */
export async function getUserRoadmaps(req: Request, res: Response) {
  const user = (req as any).user;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        goal: true,
        proficiency: true,
        createdAt: true,
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
 */
export async function getRoadmapById(req: Request, res: Response) {
  const user = (req as any).user;
  const { id } = req.params;

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


export async function healthCheck(req:Request, res: Response) {
  try {
    const fastApiUrl = process.env.FASTAPI_URL;
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


export async function ingestDocument(req:Request, res:Response) {
  try {
    const fastApiUrl = process.env.FASTAPI_URL ;
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