-- CreateTable
CREATE TABLE "TopicContent" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "topicTitle" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "phaseTitle" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicContent_roadmapId_idx" ON "TopicContent"("roadmapId");

-- CreateIndex
CREATE INDEX "TopicContent_roadmapId_phaseNumber_idx" ON "TopicContent"("roadmapId", "phaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TopicContent_roadmapId_phaseNumber_topicTitle_key" ON "TopicContent"("roadmapId", "phaseNumber", "topicTitle");

-- AddForeignKey
ALTER TABLE "TopicContent" ADD CONSTRAINT "TopicContent_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
