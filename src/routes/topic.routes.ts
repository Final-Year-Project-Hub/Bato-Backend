import { Router } from "express";
import { getTopicDetail } from "../controllers/topic.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router: Router = Router();

// All topic routes require authentication
router.use(verifyUser);

/**
 * Get detailed topic content
 * @route GET /api/topic/:phaseNumber/:topicTitle
 * @query phaseTitle - Title of the phase this topic belongs to
 * @query goal - Original roadmap goal (e.g., 'Learn React')
 */
router.get("/:phaseId/:topicId", getTopicDetail);

/**
 * Stream detailed topic content
 * @route GET /api/topic/stream/:phaseNumber/:topicTitle
 */
import { getTopicStream } from "../controllers/topic.controller";
router.get("/stream/:phaseId/:topicId", getTopicStream);
export default router;
