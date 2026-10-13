ALTER TABLE "MissionTask" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "MissionTask_planId_requestKey_key" ON "MissionTask"("planId", "requestKey");
ALTER TABLE "StudySession" ADD COLUMN "taskId" TEXT;
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MissionTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Abort on legacy overlapping sessions; never delete or repair user data implicitly.
CREATE UNIQUE INDEX "StudySession_one_running_per_user" ON "StudySession"("userId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "StudyPlan_one_active_per_user" ON "StudyPlan"("userId") WHERE "active" = true;
