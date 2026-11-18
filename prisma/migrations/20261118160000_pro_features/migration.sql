-- Pro checkout receipts and streak freezes
ALTER TABLE "MockPayment"
  ADD COLUMN "method" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "payerName" TEXT,
  ADD COLUMN "failureReason" TEXT;

CREATE TABLE "StreakFreeze" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "freezeDate" DATE NOT NULL,
  "monthKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreakFreeze_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreakFreeze_userId_examId_freezeDate_key" ON "StreakFreeze"("userId", "examId", "freezeDate");
CREATE INDEX "StreakFreeze_userId_examId_monthKey_idx" ON "StreakFreeze"("userId", "examId", "monthKey");
CREATE INDEX "StreakFreeze_userId_monthKey_idx" ON "StreakFreeze"("userId", "monthKey");

ALTER TABLE "StreakFreeze" ADD CONSTRAINT "StreakFreeze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreakFreeze" ADD CONSTRAINT "StreakFreeze_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
