-- Legacy competition results deliberately remain unverified until recalculated.
ALTER TABLE "HelpRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Competition" ADD COLUMN "resultsVerifiedAt" TIMESTAMP(3);
CREATE INDEX "CommerceNotification_inbox_idx"
  ON "CommerceNotification" ("userId", "channel", "status", "createdAt");
