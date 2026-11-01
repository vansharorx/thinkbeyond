ALTER TABLE "Repository"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "Repository_status_leaseExpiresAt_idx" ON "Repository"("status", "leaseExpiresAt");