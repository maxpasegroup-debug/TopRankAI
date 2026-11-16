ALTER TABLE "CandidateExamTarget" ADD COLUMN "dailyPaperCount" INTEGER CHECK ("dailyPaperCount" >= 1);

ALTER TABLE "ExamConfiguration" ALTER COLUMN "dailyTestCount"
  SET DEFAULT '{"BEGINNER":1,"INTERMEDIATE":2,"ADVANCED":3,"EXTREME":4}';
UPDATE "ExamConfiguration"
  SET "dailyTestCount" = '{"BEGINNER":1,"INTERMEDIATE":2,"ADVANCED":3,"EXTREME":4}'
  WHERE "dailyTestCount" = '{"BEGINNER":1,"INTERMEDIATE":2,"ADVANCED":2,"EXTREME":3}'::jsonb;
