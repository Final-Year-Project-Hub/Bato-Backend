import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import fs from "fs";
import path from "path";

/**
 * Upload documentation ZIP and trigger extraction
 */
export async function uploadDocument(req: Request, res: Response) {
  try {
    const user = req.user;
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const zipFile = req.file;
    if (!zipFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Parse form data
    const {
      frameworkKey,
      frameworkName,
      version,
      baseUrl,
      extensions,
      subdirectory,
      removePatterns,
      cleanWhitespace,
      pathPrefix,
      stripNumPrefix,
      replaceExts,
      targetTokens,
      maxTokens,
      collectionName,
      recreateCollection,
    } = req.body;

    // Validate required fields
    if (!frameworkKey || !frameworkName || !version || !baseUrl) {
      return res.status(400).json({
        error:
          "Missing required fields: frameworkKey, frameworkName, version, baseUrl",
      });
    }

    // Check if framework already exists
    const existing = await prisma.documentSource.findUnique({
      where: { frameworkKey },
    });

    if (existing) {
      return res.status(409).json({
        error: `Framework '${frameworkKey}' already exists`,
      });
    }

    // Save to local storage instead of R2
    const uploadsDir = path.join(process.cwd(), "uploads", "docs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const storageKey = `${frameworkKey}-${Date.now()}.zip`;
    const localPath = path.join(uploadsDir, storageKey);

    // Move file from temp to uploads/docs
    fs.renameSync(zipFile.path, localPath);

    // Save to database
    const docSource = await prisma.documentSource.create({
      data: {
        frameworkKey,
        frameworkName,
        version,
        baseUrl,
        extensions: Array.isArray(extensions)
          ? extensions
          : extensions.split(",").map((e: string) => e.trim()),
        subdirectory: subdirectory || null,
        removePatterns: removePatterns
          ? Array.isArray(removePatterns)
            ? removePatterns
            : removePatterns.split("\n").filter((p: string) => p.trim())
          : [],
        cleanWhitespace: cleanWhitespace !== "false",
        pathPrefix: pathPrefix || null,
        stripNumPrefix: stripNumPrefix === "true",
        replaceExts: replaceExts ? JSON.parse(replaceExts) : null,
        storageKey,
        docsPath: `docs/${frameworkKey}`,
        collectionName: collectionName || "framework_docs",
        targetTokens: parseInt(targetTokens) || 500,
        maxTokens: parseInt(maxTokens) || 2000,
        recreateCollection: recreateCollection === "true",
        status: "QUEUED",
        uploadedBy: user.id,
      },
    });

    // Call AI service to extract from local file
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";

    try {
      const extractResponse = await fetch(
        `${aiServiceUrl}/api/v1/documents/extract-local`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: docSource.id,
            frameworkKey,
            localPath,
            subdirectory: subdirectory || null,
          }),
        },
      );

      if (!extractResponse.ok) {
        throw new Error("Failed to extract documentation");
      }

      const extractData = await extractResponse.json();

      // Update file count
      await prisma.documentSource.update({
        where: { id: docSource.id },
        data: {
          fileCount: extractData.fileCount,
          totalSize: extractData.totalSize,
        },
      });

      // Call AI service to register framework
      await fetch(`${aiServiceUrl}/api/v1/documents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameworkKey,
          frameworkName,
          baseUrl,
          version,
          docsPath: `docs/${frameworkKey}`,
          collectionName: collectionName || "framework_docs",
          extensions: docSource.extensions,
          subdirectory: subdirectory || null,
          preprocessing: {
            remove_patterns: docSource.removePatterns,
            clean_whitespace: docSource.cleanWhitespace,
          },
          url_config: {
            path_prefix: pathPrefix || `${frameworkKey}/`,
            strip_numeric_prefix: stripNumPrefix === "true",
            replace_extensions: replaceExts ? JSON.parse(replaceExts) : {},
          },
        }),
      });
    } catch (aiError: any) {
      console.error("AI service error:", aiError);
      await prisma.documentSource.update({
        where: { id: docSource.id },
        data: {
          status: "FAILED",
          errorMessage: aiError.message,
        },
      });
    }

    res.json({
      success: true,
      data: docSource,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * List all document sources
 */
export async function listDocuments(req: Request, res: Response) {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { frameworkKey: { contains: search as string, mode: "insensitive" } },
        { frameworkName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const documents = await prisma.documentSource.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        frameworkKey: true,
        frameworkName: true,
        version: true,
        status: true,
        fileCount: true,
        chunksIndexed: true,
        uploadedAt: true,
        lastIngestedAt: true,
        errorMessage: true,
      },
    });

    res.json({ success: true, data: documents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single document source
 */
export async function getDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const document = await prisma.documentSource.findUnique({
      where: { id },
    });

    if (!document) {
      return res.status(404).json({ error: "Document source not found" });
    }

    res.json({ success: true, data: document });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Trigger ingestion for a document source
 */
export async function ingestDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { recreate, targetTokens, maxTokens } = req.body;

    const docSource = await prisma.documentSource.findUnique({
      where: { id },
    });

    if (!docSource) {
      return res.status(404).json({ error: "Document source not found" });
    }

    // Update status
    await prisma.documentSource.update({
      where: { id },
      data: { status: "PROCESSING" },
    });

    // Call AI service ingest endpoint
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";

    try {
      const ingestResponse = await fetch(
        `${aiServiceUrl}/api/v1/ingest?framework=${docSource.frameworkKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json();
        await prisma.documentSource.update({
          where: { id },
          data: {
            status: "FAILED",
            errorMessage: errorData.detail || "Ingestion failed",
          },
        });
        return res.status(500).json({ error: errorData.detail });
      }

      const ingestData = await ingestResponse.json();

      // Update with success
      await prisma.documentSource.update({
        where: { id },
        data: {
          status: "INGESTED",
          chunksIndexed: ingestData.chunks_indexed || 0,
          lastIngestedAt: new Date(),
          errorMessage: null,
        },
      });

      res.json({
        success: true,
        message: "Ingestion completed",
        chunksIndexed: ingestData.chunks_indexed,
      });
    } catch (aiError: any) {
      await prisma.documentSource.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: aiError.message,
        },
      });
      throw aiError;
    }
  } catch (error: any) {
    console.error("Ingestion error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete a document source
 */
export async function deleteDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const docSource = await prisma.documentSource.findUnique({
      where: { id },
    });

    if (!docSource) {
      return res.status(404).json({ error: "Document source not found" });
    }

    // Call AI service to delete files
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    try {
      await fetch(
        `${aiServiceUrl}/api/v1/documents/${docSource.frameworkKey}`,
        {
          method: "DELETE",
        },
      );
    } catch (aiError) {
      console.error("AI service delete error:", aiError);
      // Continue with DB deletion even if AI service fails
    }

    // Delete from database
    await prisma.documentSource.delete({
      where: { id },
    });

    res.json({ success: true, message: "Document source deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
