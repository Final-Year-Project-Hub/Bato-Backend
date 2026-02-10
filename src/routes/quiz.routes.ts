import { Router } from "express";
import { verifyUser } from "../middlewares/auth.middleware";
import {
  submitQuizAttempt,
  getQuizHistory,
  generateQuizForTopic,
  getBestAttempt,
  getQuizStatus,
} from "../controllers/quiz.controller";

const router = Router();

// All quiz routes require authentication
router.use(verifyUser);

// Submit quiz attempt
router.post("/submit", submitQuizAttempt);

// Get quiz history for a topic
router.get("/history/:topicContentId", getQuizHistory);

// Generate quiz for a topic (calls AI service)
router.post("/generate/:topicContentId", generateQuizForTopic);

// Get best attempt for a topic
router.get("/best/:topicContentId", getBestAttempt);

// Get quiz status by roadmap params
router.get("/status", getQuizStatus);

export default router;
