ALTER TYPE "UserRole" ADD VALUE 'CANDIDATE';

CREATE TYPE "PreparationLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'INTENSIVE');

CREATE TABLE "CandidateExamTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "preparationLevel" "PreparationLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "dailyMinutes" INTEGER NOT NULL DEFAULT 45,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateExamTarget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidateExamTarget_targetYear_check" CHECK ("targetYear" >= 2020 AND "targetYear" <= 2100),
    CONSTRAINT "CandidateExamTarget_dailyMinutes_check" CHECK ("dailyMinutes" >= 15 AND "dailyMinutes" <= 720)
);

CREATE UNIQUE INDEX "CandidateExamTarget_userId_examId_targetYear_key"
ON "CandidateExamTarget"("userId", "examId", "targetYear");
CREATE INDEX "CandidateExamTarget_userId_active_targetYear_idx"
ON "CandidateExamTarget"("userId", "active", "targetYear");
CREATE INDEX "CandidateExamTarget_examId_targetYear_idx"
ON "CandidateExamTarget"("examId", "targetYear");

ALTER TABLE "CandidateExamTarget" ADD CONSTRAINT "CandidateExamTarget_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateExamTarget" ADD CONSTRAINT "CandidateExamTarget_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionTask" ADD COLUMN "examId" TEXT;
CREATE INDEX "MissionTask_examId_dueDate_idx" ON "MissionTask"("examId", "dueDate");
ALTER TABLE "MissionTask" ADD CONSTRAINT "MissionTask_examId_fkey"
FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
