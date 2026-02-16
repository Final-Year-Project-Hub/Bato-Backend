import { prisma } from "../lib/prisma";
import {
  BadRequestException,
  ErrorCode,
  NotFoundException,
  InternalException,
} from "../utils/root";

type RoadmapData = any;

function toStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x) => typeof x === "string") as string[];
}

function extractRoadmapIds(roadmapData: RoadmapData) {
  const phases = Array.isArray(roadmapData?.phases) ? roadmapData.phases : [];

  const phaseIds: string[] = [];
  const phaseToTopicIds: Record<string, string[]> = {};
  const topicIdToNext: Record<string, { nextTopicId?: string; nextPhaseId?: string }> = {};

  for (let p = 0; p < phases.length; p++) {
    const phase = phases[p];
    const phaseId = phase?.id;
    if (typeof phaseId !== "string") continue;

    phaseIds.push(phaseId);

    const topics = Array.isArray(phase?.topics) ? phase.topics : [];
    const topicIds = topics
      .map((t: any) => t?.id)
      .filter((id: any) => typeof id === "string") as string[];

    phaseToTopicIds[phaseId] = topicIds;

   for (let t = 0; t < topicIds.length; t++) {
  const current = topicIds[t];
  const nextTopicId = topicIds[t + 1];

  // ✅ Only for the LAST topic of the phase,
  // set nextPhaseId to the next phase’s id.
  const nextPhaseId =
    t === topicIds.length - 1
      ? (phases[p + 1]?.id as string | undefined)
      : undefined;

  topicIdToNext[current] = { nextTopicId, nextPhaseId };
}
  }

  return { phaseIds, phaseToTopicIds, topicIdToNext };
}

function findTopicTitle(roadmapData: any, topicId: string): string | null {
    if (!roadmapData || !Array.isArray(roadmapData.phases)) return null;
    
    for (const phase of roadmapData.phases) {
        if (Array.isArray(phase.topics)) {
            for (const topic of phase.topics) {
                if (topic.id === topicId) {
                    return topic.topicTitle || topic.title || "Unknown Topic";
                }
            }
        }
    }
    return null;
}

export class ProgressService {
  private async getUserRoadmapOrThrow(roadmapId: string, userId: string) {
    const roadmap = await prisma.roadmap.findFirst({
      where: { id: roadmapId, userId },
      select: { id: true, roadmapData: true },
    });

    if (!roadmap) {
      throw new NotFoundException("Roadmap not found", ErrorCode.NOT_FOUND);
    }

    return roadmap;
  }

  async initializeProgress(roadmapId: string, userId: string) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const roadmapData = roadmap.roadmapData as any;

    const { phaseIds, phaseToTopicIds } = extractRoadmapIds(roadmapData);

    const firstPhaseId = phaseIds[0] ?? null;
    const firstTopicId =
      firstPhaseId ? (phaseToTopicIds[firstPhaseId]?.[0] ?? null) : null;

    const existing = await prisma.roadmapProgress.findUnique({
      where: { roadmapId },
    });

    if (existing) return existing;

    try {
      return await prisma.roadmapProgress.create({
        data: {
          roadmapId,
          completedPhaseIds: [],
          completedTopicIds: [],
          completedQuizPhaseIds: [],
          currentPhaseId: firstPhaseId,
          currentTopicId: firstTopicId,
        },
      });
    } catch (e) {
      throw new InternalException(
        "Failed to initialize progress",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async getProgress(roadmapId: string, userId: string) {
    await this.getUserRoadmapOrThrow(roadmapId, userId);

    const progress = await prisma.roadmapProgress.findUnique({
      where: { roadmapId },
    });

    if (!progress) {
      const created = await this.initializeProgress(roadmapId, userId);
      return created;
    }

    return progress;
  }

  async viewTopic(roadmapId: string, userId: string, phaseId: string, topicId: string) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const data = roadmap.roadmapData as any;

    const { phaseToTopicIds } = extractRoadmapIds(data);

    const topicIds = phaseToTopicIds[phaseId] || [];
    if (!topicIds.length) {
      throw new NotFoundException("Phase not found", ErrorCode.NOT_FOUND);
    }
    if (!topicIds.includes(topicId)) {
      throw new NotFoundException("Topic not found", ErrorCode.NOT_FOUND);
    }

    try {
      return await prisma.roadmapProgress.update({
        where: { roadmapId },
        data: {
          currentPhaseId: phaseId,
          currentTopicId: topicId,
          lastAccessedAt: new Date(),
        },
      });
    } catch (e) {
      throw new InternalException(
        "Failed to update current topic",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async completeTopic(roadmapId: string, userId: string, phaseId: string, topicId: string) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const progress = await this.getProgress(roadmapId, userId);
    const data = roadmap.roadmapData as any;

    const { phaseToTopicIds, topicIdToNext } = extractRoadmapIds(data);

    const topicIdsInPhase = phaseToTopicIds[phaseId] || [];
    if (!topicIdsInPhase.length) {
      throw new NotFoundException("Phase not found", ErrorCode.NOT_FOUND);
    }
    if (!topicIdsInPhase.includes(topicId)) {
      throw new NotFoundException("Topic not found", ErrorCode.NOT_FOUND);
    }

    const completedTopicIds = new Set(toStringArray(progress.completedTopicIds));
    completedTopicIds.add(topicId);

    const phaseAllDone =
      topicIdsInPhase.length > 0 &&
      topicIdsInPhase.every((id) => completedTopicIds.has(id));

    const nav = topicIdToNext[topicId] || {};
    let nextTopicId: string | null = null;
    let nextPhaseId: string | null = null;

    if (nav.nextTopicId) {
      nextTopicId = nav.nextTopicId;
      nextPhaseId = phaseId;
    } else if (nav.nextPhaseId) {
      nextPhaseId = nav.nextPhaseId;
      const firstTopic = (phaseToTopicIds[nextPhaseId] || [])[0] || null;
      nextTopicId = firstTopic;
    } else {
      nextPhaseId = null;
      nextTopicId = null;
    }

    try {
      const updated = await prisma.roadmapProgress.update({
        where: { roadmapId },
        data: {
          completedTopicIds: Array.from(completedTopicIds),
          currentPhaseId: nextPhaseId,
          currentTopicId: nextTopicId,
          lastAccessedAt: new Date(),
        },
      });

      // Log activity
      await prisma.userActivity.create({
        data: {
            userId,
            type: "TOPIC_COMPLETED",
            entityId: topicId,
            metadata: {
                roadmapId,
                phaseId,
                topicId,
                // Note: We don't have topic title here easily without fetching roadmapData again or passing it down
                // For now we store IDs. The frontend or controller can resolve titles if needed, 
                // or we can fetch it. Ideally we should store the title in metadata for easier display.
                // Let's try to extract it from roadmapData which we already have in `data` variable.
                topicTitle: findTopicTitle(data, topicId) || "Unknown Topic"
            }
        }
      });

      return { updated, phaseAllDone };
    } catch (e) {
      throw new InternalException(
        "Failed to complete topic",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async completePhaseQuiz(roadmapId: string, userId: string, phaseId: string, passed: boolean) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const progress = await this.getProgress(roadmapId, userId);
    const data = roadmap.roadmapData as any;

    const { phaseToTopicIds } = extractRoadmapIds(data);

    const topicIdsInPhase = phaseToTopicIds[phaseId] || [];
    if (!topicIdsInPhase.length) {
      throw new NotFoundException("Phase not found", ErrorCode.NOT_FOUND);
    }

    const completedTopicIds = new Set(toStringArray(progress.completedTopicIds));
    const allTopicsDone = topicIdsInPhase.every((id) => completedTopicIds.has(id));

    if (!allTopicsDone) {
      throw new BadRequestException(
        "Complete all topics before taking the quiz",
        ErrorCode.BAD_REQUEST,
      );
    }

    if (!passed) {
      // quiz not passed, do not mark completed
      return { updated: progress, phaseCompleted: false };
    }

    const completedPhaseIds = new Set(toStringArray(progress.completedPhaseIds));
    const completedQuizPhaseIds = new Set(toStringArray(progress.completedQuizPhaseIds));

    completedPhaseIds.add(phaseId);
    completedQuizPhaseIds.add(phaseId);

    try {
      const updated = await prisma.roadmapProgress.update({
        where: { roadmapId },
        data: {
          completedPhaseIds: Array.from(completedPhaseIds),
          completedQuizPhaseIds: Array.from(completedQuizPhaseIds),
          lastAccessedAt: new Date(),
        },
      });

      return { updated, phaseCompleted: true };
    } catch (e) {
      throw new InternalException(
        "Failed to complete phase quiz",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async addTimeSpent(roadmapId: string, userId: string, timeSpent: number) {
    await this.getUserRoadmapOrThrow(roadmapId, userId);

    try {
      return await prisma.roadmapProgress.update({
        where: { roadmapId },
        data: {
          totalTimeSpent: { increment: timeSpent },
          lastAccessedAt: new Date(),
        },
      });
    } catch (e) {
      throw new InternalException(
        "Failed to add time spent",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async reset(roadmapId: string, userId: string) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const data = roadmap.roadmapData as any;
    const { phaseIds, phaseToTopicIds } = extractRoadmapIds(data);

    const firstPhaseId = phaseIds[0] ?? null;
    const firstTopicId =
      firstPhaseId ? (phaseToTopicIds[firstPhaseId]?.[0] ?? null) : null;

    try {
      return await prisma.roadmapProgress.update({
        where: { roadmapId },
        data: {
          completedPhaseIds: [],
          completedTopicIds: [],
          completedQuizPhaseIds: [],
          currentPhaseId: firstPhaseId,
          currentTopicId: firstTopicId,
          totalTimeSpent: 0,
          lastAccessedAt: new Date(),
        },
      });
    } catch (e) {
      throw new InternalException(
        "Failed to reset progress",
        ErrorCode.INTERNAL_EXCEPTION,
        e,
      );
    }
  }

  async calculateCompletionPercentage(roadmapId: string, userId: string) {
    const roadmap = await this.getUserRoadmapOrThrow(roadmapId, userId);
    const progress = await this.getProgress(roadmapId, userId);

    const data = roadmap.roadmapData as any;
    const { phaseToTopicIds } = extractRoadmapIds(data);

    const allTopicIds = Object.values(phaseToTopicIds).flat();
    const total = allTopicIds.length;

    if (total === 0) return 0;

    const completed = new Set(toStringArray(progress.completedTopicIds));
    const validCompletedCount = allTopicIds.filter((id) => completed.has(id)).length;

    return Math.round((validCompletedCount / total) * 100);
  }
}

export const progressService = new ProgressService();
