-- Forward-only account-rights request tracking. No erasure, backfill or seed.
CREATE TABLE "AccountPrivacyRequest" (
  "id" TEXT NOT NULL, "requesterId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "response" TEXT, "completionReference" TEXT, "followUp" TEXT, "followUpKey" TEXT,
  "reviewerId" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountPrivacyRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountPrivacyRequest_kind_check" CHECK ("kind" IN ('ACCESS','CORRECT','DELETE','ACCOUNT_SUPPORT')),
  CONSTRAINT "AccountPrivacyRequest_status_check" CHECK ("status" IN ('OPEN','IN_REVIEW','AWAITING_USER','RESOLVED','REJECTED')),
  CONSTRAINT "AccountPrivacyRequest_version_check" CHECK ("version" >= 0),
  CONSTRAINT "AccountPrivacyRequest_message_check" CHECK (length("message") BETWEEN 10 AND 1000),
  CONSTRAINT "AccountPrivacyRequest_resolution_check" CHECK ("status" NOT IN ('RESOLVED','REJECTED') OR
    ("reviewerId" IS NOT NULL AND "response" IS NOT NULL AND "completionReference" IS NOT NULL
      AND length("response") BETWEEN 10 AND 1000 AND length("completionReference") BETWEEN 8 AND 200))
);
CREATE UNIQUE INDEX "AccountPrivacyRequest_requesterId_requestKey_key" ON "AccountPrivacyRequest"("requesterId","requestKey");
CREATE INDEX "AccountPrivacyRequest_subjectId_status_idx" ON "AccountPrivacyRequest"("subjectId","status");
CREATE INDEX "AccountPrivacyRequest_status_createdAt_id_idx" ON "AccountPrivacyRequest"("status","createdAt","id");
ALTER TABLE "AccountPrivacyRequest" ADD CONSTRAINT "AccountPrivacyRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountPrivacyRequest" ADD CONSTRAINT "AccountPrivacyRequest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountPrivacyRequest" ADD CONSTRAINT "AccountPrivacyRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
