-- CreateTable
CREATE TABLE "DocumentSource" (
    "id" TEXT NOT NULL,
    "frameworkKey" TEXT NOT NULL,
    "frameworkName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "extensions" TEXT[],
    "subdirectory" TEXT,
    "removePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cleanWhitespace" BOOLEAN NOT NULL DEFAULT true,
    "pathPrefix" TEXT,
    "stripNumPrefix" BOOLEAN NOT NULL DEFAULT false,
    "replaceExts" JSONB,
    "storageKey" TEXT,
    "docsPath" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL DEFAULT 'framework_docs',
    "fileCount" INTEGER,
    "totalSize" INTEGER,
    "status" "IngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "chunksIndexed" INTEGER,
    "lastIngestedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "targetTokens" INTEGER NOT NULL DEFAULT 500,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "recreateCollection" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSource_frameworkKey_key" ON "DocumentSource"("frameworkKey");

-- CreateIndex
CREATE INDEX "DocumentSource_frameworkKey_idx" ON "DocumentSource"("frameworkKey");

-- CreateIndex
CREATE INDEX "DocumentSource_status_idx" ON "DocumentSource"("status");

-- CreateIndex
CREATE INDEX "DocumentSource_uploadedBy_idx" ON "DocumentSource"("uploadedBy");

-- AddForeignKey
ALTER TABLE "DocumentSource" ADD CONSTRAINT "DocumentSource_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
