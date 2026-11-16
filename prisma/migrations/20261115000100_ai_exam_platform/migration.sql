-- CreateEnum
CREATE TYPE "SyllabusProgressStatus" AS ENUM ('NOT_STARTED', 'LEARNING', 'COMPLETED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "DailyExamStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'MISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('CORRECT', 'INCORRECT', 'UNANSWERED');

-- CreateEnum
CREATE TYPE "QuestionSourceType" AS ENUM ('AI_GENERATED', 'PREVIOUS_YEAR', 'ADMIN_CREATED', 'SEED');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('PENDING', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CalendarStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'NOT_ANNOUNCED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('APPLICATION_START', 'APPLICATION_END', 'ADMIT_CARD', 'EXAM', 'RESULT', 'COUNSELLING', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_EXAM', 'MISSED_EXAM', 'REVISION', 'TARGET', 'STREAK', 'PERFORMANCE', 'EXAM_DATE', 'MOCK', 'SYSTEM', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('QUESTIONS', 'TOPIC', 'MOCK', 'REVISION', 'MINUTES');

-- CreateEnum
CREATE TYPE "AchievementMetric" AS ENUM ('TESTS_COMPLETED', 'STREAK', 'ACCURACY', 'QUESTIONS_SOLVED', 'SYLLABUS_TOPICS', 'PERFECT_SCORE', 'MOCK_COMPLETED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "PreparationLevel_new" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXTREME');
ALTER TABLE "public"."CandidateExamTarget" ALTER COLUMN "preparationLevel" DROP DEFAULT;
ALTER TABLE "CandidateExamTarget" ALTER COLUMN "preparationLevel" TYPE "PreparationLevel_new" USING ("preparationLevel"::text::"PreparationLevel_new");
ALTER TYPE "PreparationLevel" RENAME TO "PreparationLevel_old";
ALTER TYPE "PreparationLevel_new" RENAME TO "PreparationLevel";
DROP TYPE "public"."PreparationLevel_old";
ALTER TABLE "CandidateExamTarget" ALTER COLUMN "preparationLevel" SET DEFAULT 'BEGINNER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_chapterId_fkey";

-- AlterTable
ALTER TABLE "CandidateExamTarget" ADD COLUMN     "targetExamDate" DATE,
ALTER COLUMN "preparationLevel" SET DEFAULT 'BEGINNER';

-- AlterTable
ALTER TABLE "Exam" RENAME COLUMN "category" TO "categoryKey";
ALTER TABLE "Exam" ALTER COLUMN "categoryKey" SET DEFAULT 'OTHER';
ALTER TABLE "Exam" ADD COLUMN "categoryId" TEXT,
ADD COLUMN     "defaultPreparationLevel" "PreparationLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "shortName" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "aiJobId" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "marks" DECIMAL(5,2) NOT NULL DEFAULT 4,
ADD COLUMN     "negativeMarks" DECIMAL(5,2) NOT NULL DEFAULT 1,
ADD COLUMN     "sourceType" "QuestionSourceType" NOT NULL DEFAULT 'ADMIN_CREATED',
ADD COLUMN     "syllabusRef" TEXT,
ADD COLUMN     "topicId" TEXT,
ALTER COLUMN "chapterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "currentEducationLevel" TEXT,
ADD COLUMN     "dailyStudyMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "education" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "ExamCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamConfiguration" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "totalQuestions" INTEGER NOT NULL DEFAULT 30,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "positiveMarks" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "negativeMarks" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "questionTypes" TEXT[] DEFAULT ARRAY['SINGLE_CHOICE']::TEXT[],
    "dailyTestQuestions" INTEGER NOT NULL DEFAULT 8,
    "dailyTestMinutes" INTEGER NOT NULL DEFAULT 12,
    "dailyTestCount" JSONB NOT NULL DEFAULT '{"BEGINNER":1,"INTERMEDIATE":2,"ADVANCED":2,"EXTREME":3}',
    "markingNote" TEXT,
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusUnit" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusChapter" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "formulas" TEXT,
    "examples" TEXT,
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMaterial" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LearningResourceType" NOT NULL DEFAULT 'NOTES',
    "url" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "SyllabusProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completion" INTEGER NOT NULL DEFAULT 0,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastStudiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "status" "DailyExamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "configSnapshot" JSONB NOT NULL DEFAULT '{}',
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "totalMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "negativeMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "aiGeneratedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "missedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "dailyExamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "status" "ExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "timeTakenSeconds" INTEGER NOT NULL DEFAULT 0,
    "totalMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "obtainedMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,
    "negativeMarks" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "scorePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subjectBreakdown" JSONB NOT NULL DEFAULT '{}',
    "topicBreakdown" JSONB NOT NULL DEFAULT '{}',
    "aiFeedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "selected" JSONB NOT NULL DEFAULT '[]',
    "status" "AnswerStatus" NOT NULL DEFAULT 'UNANSWERED',
    "marksAwarded" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT,
    "topicId" TEXT,
    "reason" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "goalDate" DATE NOT NULL,
    "type" "GoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "testsAttended" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "incorrect" INTEGER NOT NULL DEFAULT 0,
    "unanswered" INTEGER NOT NULL DEFAULT 0,
    "marksObtained" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "marksTotal" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "studyMinutes" INTEGER NOT NULL DEFAULT 0,
    "goalsCompleted" INTEGER NOT NULL DEFAULT 0,
    "goalsTotal" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "syllabusCompletion" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamCalendar" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "eventType" "CalendarEventType" NOT NULL DEFAULT 'EXAM',
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "CalendarStatus" NOT NULL DEFAULT 'NOT_ANNOUNCED',
    "sourceUrl" TEXT,
    "sourceLabel" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'award',
    "metric" "AchievementMetric" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "examId" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "features" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "examId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "promptChars" INTEGER NOT NULL DEFAULT 0,
    "responseChars" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamCategory_slug_key" ON "ExamCategory"("slug");

-- CreateIndex
CREATE INDEX "ExamCategory_active_order_idx" ON "ExamCategory"("active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExamConfiguration_examId_key" ON "ExamConfiguration"("examId");

-- CreateIndex
CREATE INDEX "ExamConfiguration_active_idx" ON "ExamConfiguration"("active");

-- CreateIndex
CREATE INDEX "SyllabusUnit_examId_subjectId_order_idx" ON "SyllabusUnit"("examId", "subjectId", "order");

-- CreateIndex
CREATE INDEX "SyllabusUnit_active_idx" ON "SyllabusUnit"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusUnit_examId_subjectId_slug_key" ON "SyllabusUnit"("examId", "subjectId", "slug");

-- CreateIndex
CREATE INDEX "SyllabusChapter_unitId_order_idx" ON "SyllabusChapter"("unitId", "order");

-- CreateIndex
CREATE INDEX "SyllabusChapter_active_idx" ON "SyllabusChapter"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusChapter_unitId_slug_key" ON "SyllabusChapter"("unitId", "slug");

-- CreateIndex
CREATE INDEX "SyllabusTopic_chapterId_order_idx" ON "SyllabusTopic"("chapterId", "order");

-- CreateIndex
CREATE INDEX "SyllabusTopic_active_idx" ON "SyllabusTopic"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopic_chapterId_slug_key" ON "SyllabusTopic"("chapterId", "slug");

-- CreateIndex
CREATE INDEX "StudyMaterial_topicId_order_idx" ON "StudyMaterial"("topicId", "order");

-- CreateIndex
CREATE INDEX "TopicProgress_userId_status_idx" ON "TopicProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TopicProgress_userId_topicId_key" ON "TopicProgress"("userId", "topicId");

-- CreateIndex
CREATE INDEX "DailyExam_userId_scheduledDate_status_idx" ON "DailyExam"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "DailyExam_examId_scheduledDate_idx" ON "DailyExam"("examId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyExam_userId_examId_scheduledDate_slot_key" ON "DailyExam"("userId", "examId", "scheduledDate", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_dailyExamId_key" ON "ExamAttempt"("dailyExamId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_submittedAt_idx" ON "ExamAttempt"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_examId_status_idx" ON "ExamAttempt"("userId", "examId", "status");

-- CreateIndex
CREATE INDEX "UserAnswer_questionId_idx" ON "UserAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_attemptId_questionId_key" ON "UserAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_attemptId_position_key" ON "UserAnswer"("attemptId", "position");

-- CreateIndex
CREATE INDEX "RevisionQueue_userId_status_dueDate_idx" ON "RevisionQueue"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "RevisionQueue_examId_dueDate_idx" ON "RevisionQueue"("examId", "dueDate");

-- CreateIndex
CREATE INDEX "DailyGoal_userId_goalDate_idx" ON "DailyGoal"("userId", "goalDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoal_userId_examId_goalDate_title_key" ON "DailyGoal"("userId", "examId", "goalDate", "title");

-- CreateIndex
CREATE INDEX "PerformanceRecord_userId_recordDate_idx" ON "PerformanceRecord"("userId", "recordDate");

-- CreateIndex
CREATE INDEX "PerformanceRecord_examId_recordDate_idx" ON "PerformanceRecord"("examId", "recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceRecord_userId_examId_recordDate_key" ON "PerformanceRecord"("userId", "examId", "recordDate");

-- CreateIndex
CREATE INDEX "ExamCalendar_examId_startDate_idx" ON "ExamCalendar"("examId", "startDate");

-- CreateIndex
CREATE INDEX "ExamCalendar_startDate_status_idx" ON "ExamCalendar"("startDate", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementDefinition_code_key" ON "AchievementDefinition"("code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_earnedAt_idx" ON "UserAchievement"("userId", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_endsAt_idx" ON "Subscription"("status", "endsAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_operation_createdAt_idx" ON "AIUsageLog"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "Exam_categoryId_active_idx" ON "Exam"("categoryId", "active");

-- CreateIndex
CREATE INDEX "Exam_categoryKey_active_idx" ON "Exam"("categoryKey", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Question_checksum_key" ON "Question"("checksum");

-- CreateIndex
CREATE INDEX "Question_topicId_idx" ON "Question"("topicId");

-- CreateIndex
CREATE INDEX "Question_sourceType_idx" ON "Question"("sourceType");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExamCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamConfiguration" ADD CONSTRAINT "ExamConfiguration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusUnit" ADD CONSTRAINT "SyllabusUnit_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusUnit" ADD CONSTRAINT "SyllabusUnit_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusChapter" ADD CONSTRAINT "SyllabusChapter_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "SyllabusUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "SyllabusChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyExam" ADD CONSTRAINT "DailyExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyExam" ADD CONSTRAINT "DailyExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_dailyExamId_fkey" FOREIGN KEY ("dailyExamId") REFERENCES "DailyExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQueue" ADD CONSTRAINT "RevisionQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQueue" ADD CONSTRAINT "RevisionQueue_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQueue" ADD CONSTRAINT "RevisionQueue_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionQueue" ADD CONSTRAINT "RevisionQueue_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCalendar" ADD CONSTRAINT "ExamCalendar_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
