import type { ScreenKey } from "../types/navigation";

export type RouteConfig = {
  path: string;
  label: string;
  screen: ScreenKey;
  isAppRoute?: boolean;
};

export const navigationRoutes: RouteConfig[] = [
  { path: "/home", label: "Today", screen: "home", isAppRoute: true },
  { path: "/learn/catalogue", label: "My exams", screen: "learn", isAppRoute: true },
  { path: "/learn", label: "Learn", screen: "learn", isAppRoute: true },
  { path: "/practice", label: "Practice", screen: "practice", isAppRoute: true },
  { path: "/progress", label: "Progress", screen: "progress", isAppRoute: true },
  { path: "/me", label: "Account", screen: "me", isAppRoute: true },
];

export const allRoutes: RouteConfig[] = [
  { path: "/", label: "Landing", screen: "landing" },
  { path: "/login", label: "Login", screen: "login" },
  { path: "/signup", label: "Sign up", screen: "signup" },
  { path: "/onboarding", label: "Onboarding", screen: "onboarding" },
  { path: "/welcome", label: "Welcome", screen: "welcome" },
  { path: "/mission/exam", label: "Choose exam", screen: "missionExam" },
  { path: "/mission/year", label: "Target year", screen: "missionYear" },
  { path: "/mission/college", label: "Dream college", screen: "missionCollege" },
  { path: "/mission/hours", label: "Study hours", screen: "missionHours" },
  { path: "/mission-ready", label: "Mission ready", screen: "missionReady" },
  { path: "/demo/start", label: "Demo Start", screen: "demoStart", isAppRoute: true },
  { path: "/demo", label: "Demo", screen: "demo", isAppRoute: true },
  { path: "/presentation-summary", label: "Presentation Summary", screen: "presentationSummary", isAppRoute: true },
  { path: "/success/lesson", label: "Lesson completed", screen: "successLesson", isAppRoute: true },
  { path: "/success/practice", label: "Practice finished", screen: "successPractice", isAppRoute: true },
  { path: "/success/week", label: "Weekly goal", screen: "successWeek", isAppRoute: true },
  { path: "/success/streak", label: "Streak", screen: "successStreak", isAppRoute: true },
  { path: "/success/mock", label: "Mock test", screen: "successMock", isAppRoute: true },
  { path: "/success/milestone", label: "Milestone", screen: "successMilestone", isAppRoute: true },
  ...navigationRoutes,
  { path: "/practice", label: "Practice", screen: "practice", isAppRoute: true },
  { path: "/tara", label: "SIA", screen: "tara", isAppRoute: true },
  { path: "/learn/physics", label: "Physics", screen: "learnPhysics", isAppRoute: true },
  { path: "/learn/chemistry", label: "Chemistry", screen: "learnChemistry", isAppRoute: true },
  { path: "/learn/biology", label: "Biology", screen: "learnBiology", isAppRoute: true },
  { path: "/learn/physics/motion", label: "Motion", screen: "lessonMotion", isAppRoute: true },
  { path: "/learn/revision", label: "Revision", screen: "learnRevision", isAppRoute: true },
  { path: "/learn/downloads", label: "Downloads", screen: "learnDownloads", isAppRoute: true },
  { path: "/learn/search", label: "Search", screen: "learnSearch", isAppRoute: true },
  { path: "/practice/physics", label: "Physics practice", screen: "practicePhysics", isAppRoute: true },
  { path: "/practice/question", label: "Question", screen: "practiceQuestion", isAppRoute: true },
  { path: "/practice/complete", label: "Practice complete", screen: "practiceComplete", isAppRoute: true },
  { path: "/practice/review", label: "Review", screen: "practiceReview", isAppRoute: true },
  { path: "/practice/mock-tests", label: "Mock tests", screen: "practiceMockTests", isAppRoute: true },
  { path: "/practice/papers", label: "Papers", screen: "practicePapers", isAppRoute: true },
  { path: "/tara/chat/study", label: "Study chat", screen: "taraChatStudy", isAppRoute: true },
  { path: "/tara/chat/motivate", label: "Motivation chat", screen: "taraChatMotivate", isAppRoute: true },
  { path: "/tara/chat/plan", label: "Plan chat", screen: "taraChatPlan", isAppRoute: true },
  { path: "/tara/chat/revise", label: "Revision chat", screen: "taraChatRevise", isAppRoute: true },
  { path: "/tara/chat/concept", label: "Concept chat", screen: "taraChatConcept", isAppRoute: true },
  { path: "/tara/chat/ask", label: "Ask Tara", screen: "taraChatAsk", isAppRoute: true },
  { path: "/tara/mood/great", label: "Great", screen: "taraMoodGreat", isAppRoute: true },
  { path: "/tara/mood/okay", label: "Okay", screen: "taraMoodOkay", isAppRoute: true },
  { path: "/tara/mood/stressed", label: "Stressed", screen: "taraMoodStressed", isAppRoute: true },
  { path: "/tara/mood/tired", label: "Tired", screen: "taraMoodTired", isAppRoute: true },
  { path: "/tara/reflection", label: "Reflection", screen: "taraReflection", isAppRoute: true },
  { path: "/settings", label: "Settings", screen: "settings", isAppRoute: true },
];

export function getRoute(pathname: string): RouteConfig {
  return allRoutes.find((route) => route.path === pathname) ?? allRoutes[0];
}
