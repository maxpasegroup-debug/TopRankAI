CREATE TABLE "PracticeRevisionState" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "PracticeRevisionState_pkey" PRIMARY KEY ("userId", "questionId"),
    CONSTRAINT "PracticeRevisionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeRevisionState_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PracticeRevisionState_userId_bookmarked_idx" ON "PracticeRevisionState"("userId", "bookmarked");
ALTER TABLE "Question" ADD COLUMN "supersedesId" TEXT;
ALTER TABLE "Question" ADD CONSTRAINT "Question_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Question_supersedesId_idx" ON "Question"("supersedesId");
