import { Request, Response } from "express";
import { BadRequestException, ErrorCode } from "../utils/root";
import { progressService } from "../services/progress.service";
import {
  RoadmapIdParamsSchema,
  ViewTopicSchema,
  CompleteTopicSchema,
  CompletePhaseQuizSchema,
  UpdateTimeSpentSchema,
} from "../validation/progress.validations";

export class ProgressController {
  /**
   * Get progress for a roadmap
   * GET /api/v1/roadmaps/:roadmapId/progress
   */
  async getProgress(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);

    const progress = await progressService.getProgress(roadmapId, user.id);
    const completionPercentage = await progressService.calculateCompletionPercentage(roadmapId, user.id);

    return res.json({ progress, completionPercentage });
  }

  async viewTopic(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);
    const { phaseId, topicId } = ViewTopicSchema.parse(req.body);

    const progress = await progressService.viewTopic(roadmapId, user.id, phaseId, topicId);
    return res.json({ progress });
  }

  async completeTopic(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);
    const { phaseId, topicId } = CompleteTopicSchema.parse(req.body);

    const { updated, phaseAllDone } = await progressService.completeTopic(roadmapId, user.id, phaseId, topicId);
    const completionPercentage = await progressService.calculateCompletionPercentage(roadmapId, user.id);

    return res.json({ progress: updated, phaseAllDone, completionPercentage });
  }

  async completePhaseQuiz(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);
    const { phaseId, passed } = CompletePhaseQuizSchema.parse(req.body);

    const { updated, phaseCompleted } = await progressService.completePhaseQuiz(roadmapId, user.id, phaseId, passed);

    return res.json({ progress: updated, phaseCompleted });
  }

  async addTimeSpent(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);
    const { timeSpent } = UpdateTimeSpentSchema.parse(req.body);

    const progress = await progressService.addTimeSpent(roadmapId, user.id, timeSpent);
    return res.json({ progress });
  }

  async resetProgress(req: Request, res: Response) {
    const user = req.user;
    if (!user) throw new BadRequestException("Unauthorized", ErrorCode.UNAUTHORIZED_REQUEST);

    const { roadmapId } = RoadmapIdParamsSchema.parse(req.params);

    const progress = await progressService.reset(roadmapId, user.id);
    return res.json({ progress });
  }
}

export const progressController = new ProgressController();
