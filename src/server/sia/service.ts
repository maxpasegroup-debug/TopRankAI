import type { AuthUser } from "@/server/auth/session";
import { getJourney, getMissionBoard } from "@/server/journey/service";
import { getMockRevision } from "@/server/mock/service";
import { getCompetitionSuggestion } from "@/server/competition/service";
import { getPracticeRevision } from "@/server/practice/revision";
import { assertStudent } from "@/server/student/service";
import { calendarDay } from "@/shared/study-calendar";
import { timezoneSchema } from "@/server/journey/validation";
import { missionActionAvailable, nextAccessibleLesson, nextAvailablePractice } from "./actions";
export function portalGuidance(activity: { completedTasks: number; completedLessons: number; recordedMinutes: number } | null) {
 return { source: "deterministic" as const, externalProviderConnected: false,
   suggestion: activity ? `Shared activity records show ${activity.completedTasks} completed missions and ${activity.completedLessons} lessons marked complete. Discuss the learner's next planned step.` : "No learning activity is shared within your current access scope." };
}
export async function getSiaGuidance(user: AuthUser, timezoneValue = "Asia/Kolkata", now = new Date()) {
  assertStudent(user); const timezone = timezoneSchema.parse(timezoneValue), today = calendarDay(now, timezone);
  const journey = await getJourney(user);
  const plan = await getMissionBoard(user);
  const base = { source: "deterministic" as const, externalProviderConnected: false, aiStatus: "DISABLED_PENDING_APPROVAL" as const,
    goal: journey.profile?.dreamCollege ?? null, asOf: now.toISOString(), timezone };
  if (!plan || !journey.profile?.targetExamId) return { ...base, reason: "ONBOARDING", suggestion: "Save your goals and review a seven-day mission plan.", href: "/onboarding" };
  const tasks = plan.examId === journey.profile.targetExamId ? plan.tasks.filter(task => task.status === "TODO") : [];
  const due = tasks.filter(task => task.dueDate.toISOString().slice(0, 10) <= today).slice(0, 20);
  let skippedUnavailable = 0;
  for (const task of due) {
    if (await missionActionAvailable(user, task.href, journey.profile.targetExamId)) return { ...base, reason: "MISSION", taskId: task.id, skippedUnavailable,
      suggestion: `Your next step is ${task.title}. You have allocated ${task.minutes} minutes.`, href: task.href! };
    skippedUnavailable++;
  }
  const practice = (await getPracticeRevision(user)).entries.find(entry => entry.available && entry.incorrect && !entry.reviewed);
  if (practice) return { ...base, reason: "PRACTICE_REVISION", skippedUnavailable, suggestion: "Review your latest incorrect practice answer, then retry when ready.", href: "/practice/revision" };
  const revision = (await getMockRevision(user)).find(entry => !entry.reviewedAt);
  if (revision) return { ...base, reason: "MOCK_REVISION", skippedUnavailable, suggestion: `Review ${revision.subject} from your saved mock attempt (${revision.reasons.join(", ").toLowerCase()}).`, href: "/practice/revision" };
  const future = tasks.find(task => task.dueDate.toISOString().slice(0, 10) > today);
  if (future) return { ...base, reason: "FUTURE_PLAN", skippedUnavailable, suggestion: `Your next scheduled mission is on ${future.dueDate.toISOString().slice(0, 10)}. Review your board before adding work today.`, href: "/home" };
  const lesson = await nextAccessibleLesson(user, journey.profile.targetExamId);
  if (lesson) return { ...base, reason: "LESSON", skippedUnavailable, suggestion: `Continue with ${lesson.title}, an available lesson not yet marked complete.`, href: lesson.href };
  const availablePractice = await nextAvailablePractice(journey.profile.targetExamId);
  if (availablePractice) return { ...base, reason: "PRACTICE", skippedUnavailable, suggestion: `Practice ${availablePractice.title} with available reviewed questions.`, href: availablePractice.href };
  const competition = await getCompetitionSuggestion(user);
  return { ...base, reason: competition ? "COMPETITION_ELIGIBILITY" : "NO_AVAILABLE_ACTION", skippedUnavailable,
    suggestion: competition?.suggestion ?? "No available due mission, pending revision, unfinished lesson or reviewed practice was found. Review your study board or ask for help.", href: competition?.href ?? "/home" };
}
