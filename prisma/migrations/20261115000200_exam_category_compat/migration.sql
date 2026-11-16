-- Restore the legacy Exam.category string column so the existing application
-- layer keeps working, while Exam.examCategory relation stores the new
-- categorisation used by the AI exam platform.
ALTER TABLE "Exam" RENAME COLUMN "categoryKey" TO "category";
ALTER INDEX "Exam_categoryKey_active_idx" RENAME TO "Exam_category_active_idx";
