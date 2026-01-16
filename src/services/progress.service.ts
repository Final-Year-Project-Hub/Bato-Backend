import { prisma } from "../lib/prisma.js";

interface ProgressUpdate {
  completedPhases?: number[];
  completedTopics?: string[];
  currentPhase?: number;
  currentTopic?: string;
  timeSpent?: number;
}

export class ProgressService {
  /**
   * Initialize progress tracking for a new roadmap
   */
  async initializeProgress(roadmapId: string): Promise<any> {
    const existing = await prisma.roadmapProgress.findUnique({
      where: { roadmapId },
    });

    if (existing) {
      return existing;
    }

    const progress = await prisma.roadmapProgress.create({
      data: {
        roadmapId,
        completedPhases: [],
        completedTopics: [],
        currentPhase: 0,
        totalTimeSpent: 0,
      },
    });

    return progress;
  }

  /**
   * Get progress for a roadmap
   */
  async getProgress(roadmapId: string): Promise<any | null> {
    const progress = await prisma.roadmapProgress.findUnique({
      where: { roadmapId },
      include: {
        roadmap: {
          select: {
            id: true,
            title: true,
            goal: true,
            roadmapData: true,
          },
        },
      },
    });

    return progress;
  }

  /**
   * Update progress for a roadmap
   */
  async updateProgress(
    roadmapId: string,
    updates: ProgressUpdate
  ): Promise<any> {
    const currentProgress = await this.getProgress(roadmapId);

    if (!currentProgress) {
      throw new Error("Progress not found for roadmap");
    }

    const updateData: any = {
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
    };

    if (updates.completedPhases !== undefined) {
      updateData.completedPhases = updates.completedPhases;
    }

    if (updates.completedTopics !== undefined) {
      updateData.completedTopics = updates.completedTopics;
    }

    if (updates.currentPhase !== undefined) {
      updateData.currentPhase = updates.currentPhase;
    }

    if (updates.currentTopic !== undefined) {
      updateData.currentTopic = updates.currentTopic;
    }

    if (updates.timeSpent !== undefined) {
      updateData.totalTimeSpent =
        currentProgress.totalTimeSpent + updates.timeSpent;
    }

    const updatedProgress = await prisma.roadmapProgress.update({
      where: { roadmapId },
      data: updateData,
    });

    return updatedProgress;
  }

  /**
   * Calculate completion percentage for a roadmap
   */
  async calculateCompletionPercentage(roadmapId: string): Promise<number> {
    const progress = await this.getProgress(roadmapId);

    if (!progress || !progress.roadmap) {
      return 0;
    }

    const roadmapData = progress.roadmap.roadmapData as any;
    const phases = roadmapData.phases || [];

    if (phases.length === 0) {
      return 0;
    }

    // Count total topics
    let totalTopics = 0;
    phases.forEach((phase: any) => {
      totalTopics += phase.topics?.length || 0;
    });

    if (totalTopics === 0) {
      return 0;
    }

    // Count completed topics
    const completedTopics = (progress.completedTopics as any[]) || [];
    const completionPercentage = (completedTopics.length / totalTopics) * 100;

    return Math.round(completionPercentage);
  }

  /**
   * Mark a phase as completed
   */
  async completePhase(roadmapId: string, phaseIndex: number): Promise<any> {
    const progress = await this.getProgress(roadmapId);

    if (!progress) {
      throw new Error("Progress not found");
    }

    const completedPhases = (progress.completedPhases as number[]) || [];

    if (!completedPhases.includes(phaseIndex)) {
      completedPhases.push(phaseIndex);
    }

    return await this.updateProgress(roadmapId, {
      completedPhases,
      currentPhase: phaseIndex + 1,
    });
  }

  /**
   * Mark a topic as completed
   */
  async completeTopic(roadmapId: string, topicPath: string): Promise<any> {
    const progress = await this.getProgress(roadmapId);

    if (!progress) {
      throw new Error("Progress not found");
    }

    const completedTopics = (progress.completedTopics as string[]) || [];

    if (!completedTopics.includes(topicPath)) {
      completedTopics.push(topicPath);
    }

    return await this.updateProgress(roadmapId, {
      completedTopics,
      currentTopic: topicPath,
    });
  }

  /**
   * Reset progress for a roadmap
   */
  async resetProgress(roadmapId: string): Promise<any> {
    return await prisma.roadmapProgress.update({
      where: { roadmapId },
      data: {
        completedPhases: [],
        completedTopics: [],
        currentPhase: 0,
        currentTopic: null,
        totalTimeSpent: 0,
        lastAccessedAt: new Date(),
      },
    });
  }
}

export const progressService = new ProgressService();
