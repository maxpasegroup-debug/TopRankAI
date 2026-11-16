-- CreateEnum
CREATE TYPE "SyllabusSourceKind" AS ENUM ('SYLLABUS', 'PYQ');

-- CreateEnum
CREATE TYPE "SyllabusSourceStatus" AS ENUM ('PENDING', 'IMPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "SyllabusSource" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "SyllabusSourceKind" NOT NULL DEFAULT 'SYLLABUS',
    "format" TEXT NOT NULL DEFAULT 'HTML',
    "content" TEXT,
    "status" "SyllabusSourceStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyllabusSource_examId_status_idx" ON "SyllabusSource"("examId", "status");

-- CreateIndex
CREATE INDEX "SyllabusSource_kind_status_idx" ON "SyllabusSource"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusSource_examId_url_key" ON "SyllabusSource"("examId", "url");

-- AddForeignKey
ALTER TABLE "SyllabusSource" ADD CONSTRAINT "SyllabusSource_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusSource" ADD CONSTRAINT "SyllabusSource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
