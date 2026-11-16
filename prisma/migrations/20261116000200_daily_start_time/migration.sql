ALTER TABLE "CandidateExamTarget"
  ADD COLUMN "dailyStartMinutes" INTEGER NOT NULL DEFAULT 480;

ALTER TABLE "CandidateExamTarget"
  ADD CONSTRAINT "CandidateExamTarget_dailyStartMinutes_check"
  CHECK ("dailyStartMinutes" >= 0 AND "dailyStartMinutes" <= 1439);
