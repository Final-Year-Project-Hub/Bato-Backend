import { Router } from "express";
import {
  generateRoadmapStream,
  getUserRoadmaps,
  getRoadmapById,
  selectRoadmap,
  healthCheck,
  ingestDocument,
} from "../controllers/roadmap.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router: Router = Router();

/**
 * Health check endpoint - verifies FastAPI connectivity
 * @route GET /api/roadmap/health
 */
router.get("/health", errorHandler(healthCheck));

// All routes require authentication
router.use(verifyUser);

// ============================================
// Utility Routes (must come before /:id)
// ============================================

/**
 * Document ingestion endpoint - uploads documents to vector DB via FastAPI
 * @route POST /api/roadmap/ingest
 */
router.post("/ingest", errorHandler(ingestDocument));

/**
 * Streaming roadmap generation endpoint
 * @route POST /api/roadmap/stream
 */
router.post("/stream", errorHandler(generateRoadmapStream));

// ============================================
// CRUD Routes
// ============================================

/**
 * Select a roadmap as active
 * @route POST /api/roadmap/:id/select
 */
router.post("/:id/select", errorHandler(selectRoadmap));

/**
 * Get user's roadmaps
 * @route GET /api/roadmap
 */
router.get("/", errorHandler(getUserRoadmaps));

/**
 * Get specific roadmap by ID
 * @route GET /api/roadmap/:id
 * Note: This must come AFTER specific routes like /health, /ingest, /stream
 */
router.get("/:id", errorHandler(getRoadmapById));

export default router;
