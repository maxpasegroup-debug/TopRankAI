ALTER TABLE "Lesson" ADD COLUMN "body" JSONB;

CREATE TABLE "ContentEditorialRecord" (
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "authorId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "reviewedRevision" INTEGER,
  "reviewedFingerprint" TEXT,
  "reviewEvidence" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentEditorialRecord_pkey" PRIMARY KEY ("entity", "entityId"),
  CONSTRAINT "ContentEditorialRecord_entity_check" CHECK ("entity" IN ('EXAM','SUBJECT','EXAM_SUBJECT','CHAPTER','LESSON','RESOURCE')),
  CONSTRAINT "ContentEditorialRecord_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "ContentEditorialRecord_review_check" CHECK (
    ("reviewerId" IS NULL AND "reviewedRevision" IS NULL AND "reviewedFingerprint" IS NULL AND "reviewEvidence" IS NULL AND "reviewedAt" IS NULL)
    OR ("reviewerId" IS NOT NULL AND "reviewerId" <> "authorId" AND "reviewedRevision" IS NOT NULL AND "reviewedRevision" = "revision"
      AND "reviewedFingerprint" IS NOT NULL AND "reviewedFingerprint" ~ '^[a-f0-9]{64}$'
      AND "reviewEvidence" IS NOT NULL AND length("reviewEvidence") >= 8 AND "reviewedAt" IS NOT NULL))
);
CREATE TABLE "StudentSavedResource" (
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentSavedResource_pkey" PRIMARY KEY ("userId", "resourceId"),
  CONSTRAINT "StudentSavedResource_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentSavedResource_resource_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentSavedResource_resourceId_idx" ON "StudentSavedResource"("resourceId");
