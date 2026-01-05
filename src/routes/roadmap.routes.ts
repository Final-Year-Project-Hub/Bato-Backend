import { Router } from "express";
import {
  getUserRoadmaps,
  getRoadmapById,
  healthCheck,
  ingestDocument,
} from "../controllers/roadmap.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router: Router = Router();

// All routes require authentication
router.use(verifyUser);


// Streaming generation endpoint
import { generateRoadmapStream } from "../controllers/roadmap.controller";
router.post("/stream", errorHandler(generateRoadmapStream));

// Get user's roadmaps
router.get("/", errorHandler(getUserRoadmaps));

// Get specific roadmap by ID
router.get("/:id", errorHandler(getRoadmapById));


// Health check endpoint:Just to check if the AI backend is reachable or not.
router.get("/health",healthCheck );

// Document ingestion endpoint:TO upload document into vector DB via FastAPI
router.post("/api/v1/ingest",ingestDocument );


export default router;
