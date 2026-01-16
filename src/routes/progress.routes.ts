import { Router } from "express";
import { progressController } from "../controllers/progress.controller";
import { errorHandler } from "../middlewares/error-handler";
import { verifyUser } from "../middlewares/auth.middleware";

const router = Router({ mergeParams: true });

// All progress routes require authentication
router.use(verifyUser);

// Progress routes (nested under /roadmaps/:roadmapId/progress)
router.get(
  "/",
  errorHandler(progressController.getProgress.bind(progressController))
);
router.patch(
  "/",
  errorHandler(progressController.updateProgress.bind(progressController))
);
router.post(
  "/complete-phase",
  errorHandler(progressController.completePhase.bind(progressController))
);
router.post(
  "/complete-topic",
  errorHandler(progressController.completeTopic.bind(progressController))
);
router.post(
  "/reset",
  errorHandler(progressController.resetProgress.bind(progressController))
);

export default router;
