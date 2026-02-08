/*
  Warnings:

  - A unique constraint covering the columns `[roadmapId,phaseId,topicId]` on the table `TopicContent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phaseId` to the `TopicContent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topicId` to the `TopicContent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TopicContent_roadmapId_phaseNumber_idx";

-- DropIndex
DROP INDEX "TopicContent_roadmapId_phaseNumber_topicTitle_key";

-- AlterTable
ALTER TABLE "TopicContent" ADD COLUMN     "phaseId" TEXT NOT NULL,
ADD COLUMN     "topicId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "TopicContent_roadmapId_phaseId_idx" ON "TopicContent"("roadmapId", "phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicContent_roadmapId_phaseId_topicId_key" ON "TopicContent"("roadmapId", "phaseId", "topicId");
