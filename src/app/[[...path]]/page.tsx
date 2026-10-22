import { AppShell } from "@/components/layout/AppShell";
import { GetHelp } from "@/components/journey/GetHelp";
import { PageContainer } from "@/components/ui/PageContainer";
import { ToastStack } from "@/components/polish/Toast";
import { ProductTour } from "@/components/demo/ProductTour";
import { PresenterPanel } from "@/components/demo/PresenterPanel";
import { getRoute } from "../routes";
import { AuthPage } from "@/screens/AuthPages";
import { DemoMissionControl } from "@/screens/DemoMissionControl";
import { DemoStart } from "@/screens/DemoStart";
import { Home } from "@/screens/Home";
import { Landing } from "@/screens/Landing";
import { Learn } from "@/screens/Learn";
import { Downloads } from "@/screens/learning/Downloads";
import { LearnSearch } from "@/screens/learning/LearnSearch";
import { LessonExperience } from "@/screens/learning/LessonExperience";
import { ChapterLessons } from "@/screens/learning/ChapterLessons";
import { Revision } from "@/screens/learning/Revision";
import { SubjectWorkspace } from "@/screens/learning/SubjectWorkspace";
import { Me } from "@/screens/Me";
import { MissionFlow, MissionReady, WelcomeJourney } from "@/screens/MissionFlow";
import { Onboarding } from "@/screens/Onboarding";
import { ParentPreview } from "@/screens/ParentPreview";
import { PresentationSummary } from "@/screens/PresentationSummary";
import { Practice } from "@/screens/Practice";
import { ChapterPractice } from "@/screens/practice/ChapterPractice";
import { MockTests } from "@/screens/practice/MockTests";
import { PracticeComplete } from "@/screens/practice/PracticeComplete";
import { PracticeReview } from "@/screens/practice/PracticeReview";
import { PreviousYearPapers } from "@/screens/practice/PreviousYearPapers";
import { QuestionExperience } from "@/screens/practice/QuestionExperience";
import { Progress } from "@/screens/Progress";
import { Settings } from "@/screens/Settings";
import { SchoolPreview } from "@/screens/SchoolPreview";
import { Tara } from "@/screens/Tara";
import { SuccessState } from "@/screens/SuccessState";
import { TaraChat } from "@/screens/tara/TaraChat";
import { TaraMood } from "@/screens/tara/TaraMood";
import { TaraReflection } from "@/screens/tara/TaraReflection";
import { parentRoles, schoolRoles } from "@/server/auth/roles";
import { redirect } from "next/navigation";
import type { ScreenKey } from "@/types/navigation";
import type { AuthUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type RenderContext = {
  user: AuthUser | null;
  pathname: string;
};

async function renderScreen(screen: ScreenKey, context: RenderContext) {
  const learningPath = parseLearningContentPath(context.pathname);
  const practicePath = parsePracticeContentPath(context.pathname);

  if (learningPath && context.user) {
    if (learningPath.kind === "subject") {
      const { listChaptersForSubject } = await import("@/server/content/service");
      const data = await listChaptersForSubject(learningPath.subjectSlug);
      return <SubjectWorkspace subject={data.subject.name} contentSubject={data.subject} contentChapters={data.chapters} />;
    }

    if (learningPath.kind === "chapter") {
      const { listLessonsForChapter } = await import("@/server/content/service");
      const data = await listLessonsForChapter(learningPath.chapterSlug, learningPath.subjectSlug);
      return <ChapterLessons subject={data.subject} chapter={data.chapter} lessons={data.lessons} />;
    }

    if (learningPath.kind === "lesson") {
      const { getLessonDetail } = await import("@/server/content/service");
      return <LessonExperience lesson={await getLessonDetail(learningPath.lessonSlug, learningPath)} />;
    }
  }

  if (practicePath && context.user) {
    if (practicePath.kind === "subject") {
      const { listQuestionsForSubject } = await import("@/server/question/service");
      const data = await listQuestionsForSubject(practicePath.subjectSlug);
      return <ChapterPractice subject={data.subject} questions={data.questions} />;
    }

    if (practicePath.kind === "chapter") {
      const { listQuestionsForChapter } = await import("@/server/question/service");
      const data = await listQuestionsForChapter(practicePath.chapterSlug);
      return <ChapterPractice subject={data.subject} chapter={data.chapter} questions={data.questions} />;
    }

    if (practicePath.kind === "question") {
      const { getQuestion } = await import("@/server/question/service");
      return <QuestionExperience question={await getQuestion(practicePath.questionId)} />;
    }
  }

  switch (screen) {
    case "getHelp": return <PageContainer><GetHelp /></PageContainer>;
    case "compete": return <PageContainer><main className="journey-shell"><h1>Compete</h1><p>No published challenges yet.</p><a href="/practice">Continue practice</a></main></PageContainer>;
    case "login":
      return <AuthPage mode="login" />;
    case "signup":
      return <AuthPage mode="signup" />;
    case "onboarding":
      return <Onboarding />;
    case "welcome":
    case "missionExam":
    case "missionYear":
    case "missionCollege":
    case "missionHours":
      if (!context.user) {
        redirect("/login");
      }
      redirect("/onboarding");
    case "missionReady":
      redirect("/home");
    case "demoStart":
      return <DemoStart />;
    case "demo":
      return <DemoMissionControl />;
    case "presentationSummary":
      return <PresentationSummary />;
    case "successLesson":
    case "successPractice":
    case "successWeek":
    case "successStreak":
    case "successMock":
    case "successMilestone":
      redirect("/progress");
    case "home":
      if (!context.user) {
        redirect("/login");
      }
      const { getMissionControl } = await import("@/server/student/service");
      return <Home {...(await getMissionControl(context.user))} />;
    case "learn":
      if (!context.user) {
        redirect("/login");
      }
      const { getStudentLearningHome } = await import("@/server/content/service");
      return <Learn {...(await getStudentLearningHome(context.user))} />;
    case "learnPhysics":
      return <SubjectWorkspace subject="Physics" />;
    case "learnChemistry":
      return <SubjectWorkspace subject="Chemistry" />;
    case "learnBiology":
      return <SubjectWorkspace subject="Biology" />;
    case "lessonMotion":
      return <LessonExperience />;
    case "learnRevision":
      redirect("/practice/revision");
    case "learnDownloads":
    case "learnSearch":
      redirect("/learn");
    case "practice":
      if (!context.user) {
        redirect("/login");
      }
      const { getStudentPracticeHome } = await import("@/server/question/service");
      return <Practice {...(await getStudentPracticeHome(context.user))} />;
    case "practicePhysics":
      const { listQuestionsForSubject } = await import("@/server/question/service");
      return <ChapterPractice {...(await listQuestionsForSubject("physics"))} />;
    case "practiceQuestion":
      if (!context.user) {
        redirect("/login");
      }
      const { getStudentPracticeHome: getPracticeHomeForQuestion, listQuestions } = await import("@/server/question/service");
      return <QuestionExperience question={(await listQuestions({ exam: (await getPracticeHomeForQuestion(context.user)).exam?.code })).at(0) ?? null} />;
    case "practiceComplete":
    case "practiceReview":
      return <PracticeReview />;
    case "practiceMockTests":
      redirect("/practice/mock-tests");
    case "practicePapers":
      return <PageContainer><main className="journey-shell"><h1>Previous-year papers</h1><p>No reviewed papers are available yet.</p><a href="/practice">Continue practice</a></main></PageContainer>;
    case "progress":
      return <Progress />;
    case "tara":
    case "taraChatStudy":
    case "taraChatMotivate":
    case "taraChatPlan":
    case "taraChatRevise":
    case "taraChatConcept":
    case "taraChatAsk":
    case "taraMoodGreat":
    case "taraMoodOkay":
    case "taraMoodStressed":
    case "taraMoodTired":
    case "taraReflection":
      redirect("/get-help");
    case "me":
      if (!context.user) {
        redirect("/login");
      }
      const { getStudentProfile } = await import("@/server/student/service");
      return <Me profile={await getStudentProfile(context.user)} />;
    case "parentPreview":
      return <PageContainer><main className="journey-shell"><h1>Parent workspace</h1><p>Student reports are unavailable until consent and relationship verification are implemented.</p></main></PageContainer>;
    case "schoolPreview":
      return <PageContainer><main className="journey-shell"><h1>School workspace</h1><p>Student reports are unavailable until verified school enrolment and tenant boundaries are implemented.</p></main></PageContainer>;
    case "settings":
      return <Settings />;
    case "landing":
    default:
      return <Landing />;
  }
}

function getPath(path?: string[]) {
  if (!path || path.length === 0) {
    return "/";
  }

  return `/${path.join("/")}`;
}

function isPublicDemoPath(pathname: string) {
  return pathname === "/demo" || pathname === "/demo/start" || pathname === "/presentation-summary";
}

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/login" || pathname === "/signup" || isPublicDemoPath(pathname);
}

function parseLearningContentPath(pathname: string) {
  const reserved = new Set(["revision", "downloads", "search"]);
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] !== "learn" || parts.length < 2 || reserved.has(parts[1])) {
    return null;
  }

  if (parts.length === 2) {
    return { kind: "subject" as const, subjectSlug: parts[1] };
  }

  if (parts.length === 3) {
    return { kind: "chapter" as const, subjectSlug: parts[1], chapterSlug: parts[2] };
  }

  if (parts.length === 4) {
    return { kind: "lesson" as const, subjectSlug: parts[1], chapterSlug: parts[2], lessonSlug: parts[3] };
  }

  return null;
}

function parsePracticeContentPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] !== "practice") {
    return null;
  }

  if (parts.length === 4 && parts[1] === "subjects" && parts[3] === "questions") {
    return { kind: "subject" as const, subjectSlug: parts[2] };
  }

  if (parts.length === 4 && parts[1] === "chapters" && parts[3] === "questions") {
    return { kind: "chapter" as const, chapterSlug: parts[2] };
  }

  if (parts.length === 3 && parts[1] === "questions") {
    return { kind: "question" as const, questionId: parts[2] };
  }

  return null;
}

function isStudentOnboardingPath(screen: ScreenKey) {
  return screen === "onboarding" || screen === "welcome" || screen === "missionExam" || screen === "missionYear" || screen === "missionCollege" || screen === "missionHours" || screen === "missionReady";
}

function isStudentAppScreen(screen: ScreenKey) {
  return [
    "home",
    "getHelp",
    "compete",
    "learn",
    "learnPhysics",
    "learnChemistry",
    "learnBiology",
    "lessonMotion",
    "learnRevision",
    "learnDownloads",
    "learnSearch",
    "practice",
    "practicePhysics",
    "practiceQuestion",
    "practiceComplete",
    "practiceReview",
    "practiceMockTests",
    "practicePapers",
    "progress",
    "tara",
    "taraChatStudy",
    "taraChatMotivate",
    "taraChatPlan",
    "taraChatRevise",
    "taraChatConcept",
    "taraChatAsk",
    "taraMoodGreat",
    "taraMoodOkay",
    "taraMoodStressed",
    "taraMoodTired",
    "taraReflection",
    "me",
    "settings",
  ].includes(screen);
}

function Unauthorized() {
  return (
    <main className="auth-container">
      <section className="auth-panel compact-auth">
        <div className="auth-form">
          <h1 className="section-title">Access restricted</h1>
          <p className="section-subtitle">Your account does not have access to this area yet.</p>
          <a className="button button-primary" href="/home">Back to Mission Control</a>
        </div>
      </section>
    </main>
  );
}

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const resolvedParams = await params;
  const pathname = getPath(resolvedParams.path);

  if (pathname === "/unauthorized") {
    const { requireAuth } = await import("@/server/auth/session");
    await requireAuth();
    return <Unauthorized />;
  }

  const route = getRoute(pathname);
  let user: AuthUser | null = null;
  const isLearningContent = Boolean(parseLearningContentPath(pathname));
  const isPracticeContent = Boolean(parsePracticeContentPath(pathname));

  if (!isPublicPath(pathname)) {
    if (route.screen === "parentPreview") {
      const { requireRole } = await import("@/server/auth/session");
      user = await requireRole(parentRoles);
    } else if (route.screen === "schoolPreview") {
      const { requireRole } = await import("@/server/auth/session");
      user = await requireRole(schoolRoles);
    } else if (isLearningContent || isPracticeContent || isStudentAppScreen(route.screen) || isStudentOnboardingPath(route.screen)) {
      const { requireRole } = await import("@/server/auth/session");
      user = await requireRole(["STUDENT"]);
    } else {
      const { requireAuth } = await import("@/server/auth/session");
      user = await requireAuth();
    }
  }

  if (user?.role === "STUDENT") {
    const { getOnboardingStatus } = await import("@/server/student/service");
    const status = await getOnboardingStatus(user);

    if (route.screen === "missionReady" && !status.completed) {
      redirect("/onboarding");
    }

    if ((isLearningContent || isPracticeContent || isStudentAppScreen(route.screen)) && !status.completed) {
      redirect("/onboarding");
    }
  }

  const screen = await renderScreen(route.screen, { user, pathname });

  if (!route.isAppRoute && !isLearningContent && !isPracticeContent) {
    return <div className="app-shell">{screen}</div>;
  }

  const isDemoMode = isPublicDemoPath(pathname);

  return (
    <>
      <AppShell currentPath={isLearningContent ? "/learn" : isPracticeContent ? "/practice" : route.path}>{screen}</AppShell>
      {isDemoMode ? <ProductTour currentPath={route.path} /> : null}
      {isDemoMode ? <PresenterPanel currentPath={route.path} /> : null}
      <ToastStack />
    </>
  );
}
