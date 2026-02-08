import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Submit a quiz attempt
 */
export const submitQuizAttempt = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { topicContentId, answers, timeSpent } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get topic content with quiz
    const topicContent = await prisma.topicContent.findUnique({
      where: { id: topicContentId },
    });

    if (!topicContent) {
      return res.status(404).json({ error: "Topic content not found" });
    }

    const quiz = topicContent.quiz as any;

    if (!quiz || !quiz.questions) {
      return res.status(404).json({ error: "Quiz not found for this topic" });
    }

    // Calculate score
    const { score, correctAnswers, feedback } = calculateScore(quiz, answers);

    // Save attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        topicContentId,
        answers,
        score,
        totalQuestions: quiz.questions.length,
        correctAnswers,
        timeSpent: timeSpent || null,
      },
    });

    res.json({
      attemptId: attempt.id,
      score,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      feedback,
      passed: score >= (quiz.metadata?.passingScore || 70),
    });
  } catch (error: any) {
    console.error("Error submitting quiz attempt:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get quiz history for a topic
 */
export const getQuizHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { topicContentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        topicContentId,
      },
      orderBy: { completedAt: "desc" },
    });

    res.json(attempts);
  } catch (error: any) {
    console.error("Error fetching quiz history:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate quiz for a topic (calls AI service)
 */
export const generateQuizForTopic = async (req: Request, res: Response) => {
  try {
    const { topicContentId } = req.params;

    // Get topic content
    const topicContent = await prisma.topicContent.findUnique({
      where: { id: topicContentId },
      include: {
        roadmap: true,
      },
    });

    if (!topicContent) {
      return res.status(404).json({ error: "Topic content not found" });
    }

    // Check if quiz already exists
    if (topicContent.quiz) {
      return res.json(topicContent.quiz);
    }

    // Call AI service to generate quiz
    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/api/v1/quiz/generate`,
      {
        goal: topicContent.roadmap.goal,
        phase_title: topicContent.phaseTitle,
        topic_title: topicContent.topicTitle,
        topic_content: topicContent.content,
      },
    );

    const quiz = aiResponse.data;

    // Save quiz to database
    const updated = await prisma.topicContent.update({
      where: { id: topicContentId },
      data: { quiz },
    });

    res.json(quiz);
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get user's best attempt for a topic
 */
export const getBestAttempt = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { topicContentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bestAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        topicContentId,
      },
      orderBy: { score: "desc" },
    });

    if (!bestAttempt) {
      return res.status(404).json({ error: "No attempts found" });
    }

    res.json(bestAttempt);
  } catch (error: any) {
    console.error("Error fetching best attempt:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calculate quiz score
 */
function calculateScore(quiz: any, userAnswers: Record<number, string>) {
  let correctAnswers = 0;
  const feedback: any[] = [];

  quiz.questions.forEach((question: any) => {
    const userAnswer = userAnswers[question.id];
    const isCorrect = userAnswer === question.correctAnswer;

    if (isCorrect) {
      correctAnswers++;
    }

    feedback.push({
      questionId: question.id,
      question: question.question,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: question.explanation,
    });
  });

  const score = (correctAnswers / quiz.questions.length) * 100;

  return {
    score: Math.round(score * 10) / 10, // Round to 1 decimal
    correctAnswers,
    feedback,
  };
}
