/*
  Warnings:

  - You are about to drop the column `completedPhases` on the `RoadmapProgress` table. All the data in the column will be lost.
  - You are about to drop the column `completedTopics` on the `RoadmapProgress` table. All the data in the column will be lost.
  - You are about to drop the column `currentPhase` on the `RoadmapProgress` table. All the data in the column will be lost.
  - You are about to drop the column `currentTopic` on the `RoadmapProgress` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RoadmapProgress" DROP COLUMN "completedPhases",
DROP COLUMN "completedTopics",
DROP COLUMN "currentPhase",
DROP COLUMN "currentTopic",
ADD COLUMN     "completedPhaseIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "completedQuizPhaseIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "completedTopicIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "currentPhaseId" TEXT,
ADD COLUMN     "currentTopicId" TEXT;
