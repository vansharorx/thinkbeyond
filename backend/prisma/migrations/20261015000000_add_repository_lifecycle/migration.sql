CREATE TYPE "RepositoryStatus" AS ENUM ('pending', 'cloning', 'analyzing', 'ready', 'failed');

ALTER TABLE "Repository"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "status" "RepositoryStatus" NOT NULL DEFAULT 'ready',
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "Repository_status_updatedAt_idx" ON "Repository"("status", "updatedAt");
CREATE UNIQUE INDEX "Repository_ownerId_sourceKey_key" ON "Repository"("ownerId", "sourceKey");