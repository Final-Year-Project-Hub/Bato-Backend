/*
  Warnings:

  - You are about to drop the column `quiz` on the `TopicContent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "QuizAttempt_userId_topicContentId_idx";

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "quizId" TEXT;

-- AlterTable
ALTER TABLE "TopicContent" DROP COLUMN "quiz";

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "topicContentId" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "sourceSection" TEXT NOT NULL,
    "learningObjective" TEXT NOT NULL,
    "passingScore" DOUBLE PRECISION NOT NULL,
    "estimatedTime" INTEGER NOT NULL,
    "difficultyBreakdown" JSONB NOT NULL,
    "conceptCoverage" JSONB NOT NULL,
    "codeQuestionCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_topicContentId_idx" ON "Quiz"("topicContentId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_topicContentId_quizId_idx" ON "QuizAttempt"("userId", "topicContentId", "quizId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_topicContentId_fkey" FOREIGN KEY ("topicContentId") REFERENCES "TopicContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
