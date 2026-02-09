import { Router } from "express";
import { progressController } from "../controllers/progress.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });

// All progress routes require authentication
router.use(verifyUser);

// Progress routes (nested under /roadmaps/:roadmapId/progress)

// Get progress + completion percentage
router.get(
  "/",
  errorHandler(progressController.getProgress.bind(progressController)),
);

// When user opens/views a topic (updates currentPhaseId/currentTopicId)
router.post(
  "/view-topic",
  errorHandler(progressController.viewTopic.bind(progressController)),
);

// Mark a topic completed (adds to completedTopicIds, returns phaseAllDone + percentage)
router.post(
  "/complete-topic",
  errorHandler(progressController.completeTopic.bind(progressController)),
);

// Complete phase only after quiz (requires all topics completed + passed=true)
router.post(
  "/complete-phase-quiz",
  errorHandler(progressController.completePhaseQuiz.bind(progressController)),
);

// Add time spent (increments totalTimeSpent)
router.post(
  "/time-spent",
  errorHandler(progressController.addTimeSpent.bind(progressController)),
);

// Reset progress for roadmap
router.post(
  "/reset",
  errorHandler(progressController.resetProgress.bind(progressController)),
);

export default router;
