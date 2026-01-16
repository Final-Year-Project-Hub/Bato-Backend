import { Request, Response } from "express";
import { progressService } from "../services/progress.service";

export class ProgressController {
  /**
   * Get progress for a roadmap
   * GET /api/v1/roadmaps/:roadmapId/progress
   */
  async getProgress(req: Request, res: Response) {
    try {
      const { roadmapId } = req.params;

      const progress = await progressService.getProgress(roadmapId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          error: "Progress not found for this roadmap",
        });
      }

      const completionPercentage =
        await progressService.calculateCompletionPercentage(roadmapId);

      res.status(200).json({
        success: true,
        data: {
          ...progress,
          completionPercentage,
        },
      });
    } catch (error: any) {
      console.error("[ProgressController] Error getting progress:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get progress",
      });
    }
  }

  /**
   * Update progress for a roadmap
   * PATCH /api/v1/roadmaps/:roadmapId/progress
   */
  async updateProgress(req: Request, res: Response) {
    try {
      const { roadmapId } = req.params;
      const updates = req.body;

      const progress = await progressService.updateProgress(roadmapId, updates);

      const completionPercentage =
        await progressService.calculateCompletionPercentage(roadmapId);

      res.status(200).json({
        success: true,
        data: {
          ...progress,
          completionPercentage,
        },
      });
    } catch (error: any) {
      console.error("[ProgressController] Error updating progress:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update progress",
      });
    }
  }

  /**
   * Complete a phase
   * POST /api/v1/roadmaps/:roadmapId/progress/complete-phase
   */
  async completePhase(req: Request, res: Response) {
    try {
      const { roadmapId } = req.params;
      const { phaseIndex } = req.body;

      if (phaseIndex === undefined) {
        return res.status(400).json({ error: "phaseIndex is required" });
      }

      const progress = await progressService.completePhase(
        roadmapId,
        phaseIndex
      );

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      console.error("[ProgressController] Error completing phase:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to complete phase",
      });
    }
  }

  /**
   * Complete a topic
   * POST /api/v1/roadmaps/:roadmapId/progress/complete-topic
   */
  async completeTopic(req: Request, res: Response) {
    try {
      const { roadmapId } = req.params;
      const { topicPath } = req.body;

      if (!topicPath) {
        return res.status(400).json({ error: "topicPath is required" });
      }

      const progress = await progressService.completeTopic(
        roadmapId,
        topicPath
      );

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      console.error("[ProgressController] Error completing topic:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to complete topic",
      });
    }
  }

  /**
   * Reset progress for a roadmap
   * POST /api/v1/roadmaps/:roadmapId/progress/reset
   */
  async resetProgress(req: Request, res: Response) {
    try {
      const { roadmapId } = req.params;

      const progress = await progressService.resetProgress(roadmapId);

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      console.error("[ProgressController] Error resetting progress:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to reset progress",
      });
    }
  }
}

export const progressController = new ProgressController();
