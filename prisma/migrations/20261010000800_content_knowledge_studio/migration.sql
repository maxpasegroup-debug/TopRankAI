CREATE TABLE "SyllabusVersion" (
 "id" TEXT PRIMARY KEY, "examId" TEXT NOT NULL, "label" TEXT NOT NULL,
 "sourceUrl" TEXT NOT NULL, "evidence" TEXT NOT NULL, "effectiveFrom" TIMESTAMP(3),
 "supersedesId" TEXT, "outline" JSONB NOT NULL, "state" TEXT NOT NULL DEFAULT 'DRAFT',
 "authorId" TEXT NOT NULL, "reviewerId" TEXT, "reviewedAt" TIMESTAMP(3), "decision" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SyllabusVersion_state_check" CHECK ("state" IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','RETIRED')),
 CONSTRAINT "SyllabusVersion_review_check" CHECK ("state" NOT IN ('APPROVED','PUBLISHED') OR ("reviewerId" IS NOT NULL AND "reviewerId" <> "authorId" AND "reviewedAt" IS NOT NULL AND "decision" IS NOT NULL AND length("decision") >= 8)),
 CONSTRAINT "SyllabusVersion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "SyllabusVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SyllabusVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SyllabusVersion_examId_label_key" ON "SyllabusVersion"("examId", "label");
CREATE INDEX "SyllabusVersion_state_examId_idx" ON "SyllabusVersion"("state", "examId");
CREATE TABLE "ContentSource" (
 "id" TEXT PRIMARY KEY, "entity" TEXT NOT NULL, "entityId" TEXT NOT NULL,
 "title" TEXT NOT NULL, "url" TEXT, "rightsHolder" TEXT NOT NULL, "origin" TEXT NOT NULL,
 "licence" TEXT NOT NULL, "attribution" TEXT NOT NULL, "permissionEvidence" TEXT NOT NULL,
 "authorId" TEXT NOT NULL, "reviewerId" TEXT, "reviewedAt" TIMESTAMP(3),
 "contentFingerprint" TEXT NOT NULL, "siaIncluded" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ContentSource_entity_check" CHECK ("entity" IN ('EXAM','SUBJECT','EXAM_SUBJECT','CHAPTER','LESSON','RESOURCE')),
 CONSTRAINT "ContentSource_origin_check" CHECK ("origin" IN ('ORIGINAL','LICENSED','PUBLIC_REFERENCE','AI_ASSISTED')),
 CONSTRAINT "ContentSource_review_check" CHECK (("reviewerId" IS NULL AND "reviewedAt" IS NULL) OR ("reviewerId" IS NOT NULL AND "reviewerId" <> "authorId" AND "reviewedAt" IS NOT NULL)),
 CONSTRAINT "ContentSource_fingerprint_check" CHECK ("contentFingerprint" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "ContentSource_entity_entityId_key" ON "ContentSource"("entity", "entityId");
CREATE TABLE "ContentKnowledgeJob" (
 "id" TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'BLOCKED', "reason" TEXT NOT NULL, "requestedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "completedAt" TIMESTAMP(3),
 CONSTRAINT "ContentKnowledgeJob_state_check" CHECK ("state" IN ('BLOCKED','STALE','PENDING','PROCESSING','FAILED','SUCCEEDED')),
 CONSTRAINT "ContentKnowledgeJob_fingerprint_check" CHECK ("fingerprint" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "ContentKnowledgeJob_completed_check" CHECK ("state" <> 'SUCCEEDED' OR "completedAt" IS NOT NULL),
 CONSTRAINT "ContentKnowledgeJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContentKnowledgeJob_sourceId_fingerprint_key" ON "ContentKnowledgeJob"("sourceId", "fingerprint");
CREATE INDEX "ContentKnowledgeJob_state_createdAt_idx" ON "ContentKnowledgeJob"("state", "createdAt");
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentKnowledgeJob" ADD CONSTRAINT "ContentKnowledgeJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
