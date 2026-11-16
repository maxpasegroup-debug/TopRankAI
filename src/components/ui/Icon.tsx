import type { ScreenKey } from "../../types/navigation";

type IconProps = {
  name: ScreenKey | "settings" | "arrow" | "spark" | "check";
};

const paths: Record<IconProps["name"], string> = {
  landing: "M4 12h16M12 4l8 8-8 8",
  login: "M10 17l5-5-5-5M15 12H3M21 5v14",
  signup: "M12 5v14M5 12h14M18 18l3 3",
  onboarding: "M5 19V5h14v14M8 9h8M8 13h5",
  welcome: "M4 12l4 4L20 4M5 20h14",
  missionExam: "M5 5h14v14H5zM8 9h8M8 13h5",
  missionYear: "M7 4v3M17 4v3M5 8h14M6 6h12v14H6z",
  missionCollege: "M4 20h16M6 20V9l6-4 6 4v11M10 20v-6h4v6",
  missionHours: "M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  missionReady: "M5 13l4 4L19 7M12 3l2 4 4 .6-3 3 .7 4.4L12 13l-3.7 2.8.7-4.4-3-3 4-.6 2-4z",
  demoStart: "M5 5h14v14H5zM8 12h8M12 8v8",
  demo: "M5 5h14v14H5zM8 12h8M12 8v8",
  presentationSummary: "M5 5h14v14H5zM8 9h8M8 13h8M8 17h5",
  successLesson: "M5 13l4 4L19 7",
  successPractice: "M5 13l4 4L19 7",
  successWeek: "M5 13l4 4L19 7",
  successStreak: "M5 13l4 4L19 7",
  successMock: "M5 13l4 4L19 7",
  successMilestone: "M5 13l4 4L19 7",
  home: "M4 11l8-7 8 7v9H5v-9",
  getHelp: "M4 5h16v11H8l-4 4V5z",
  compete: "M7 4h10v8a5 5 0 01-10 0V4zM12 17v3M8 20h8M7 6H4v4a3 3 0 003 3M17 6h3v4a3 3 0 01-3 3",
  learn: "M5 5h10a4 4 0 014 4v10H9a4 4 0 01-4-4V5zM9 9h6M9 13h4",
  learnPhysics: "M12 4v16M8 8h8M7 16h10M5 12h14",
  learnChemistry: "M9 3h6M10 3v6l-4 8a3 3 0 003 4h6a3 3 0 003-4l-4-8V3",
  learnBiology: "M12 20c5-3 7-8 4-12-4 0-8 3-8 8 4 0 7-2 8-8",
  lessonMotion: "M4 12h12M12 6l6 6-6 6M5 18h4",
  learnRevision: "M5 5h14v14H5zM8 9h8M8 13h8M8 17h5",
  learnDownloads: "M12 4v10M8 10l4 4 4-4M5 20h14",
  learnSearch: "M11 5a6 6 0 104.2 10.2L20 20",
  practice: "M7 4h10v4H7zM5 8h14v12H5zM9 13h6M9 17h3",
  practicePhysics: "M7 4h10v4H7zM5 8h14v12H5zM9 13h6M9 17h3",
  practiceQuestion: "M9 9a3 3 0 116 0c0 2-3 2-3 5M12 18h.01M4 4h16v16H4z",
  practiceComplete: "M5 13l4 4L19 7M4 4h16v16H4z",
  practiceReview: "M5 5h14v14H5zM8 9h8M8 13h6M8 17h4",
  practiceMockTests: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h3",
  practicePapers: "M7 4h8l4 4v12H7zM15 4v5h5M10 13h6M10 17h4",
  progress: "M5 19V5M5 19h14M9 16v-5M13 16V8M17 16v-8",
  tara: "M12 4l2.2 5.2L20 10l-4.3 3.8L17 20l-5-3.2L7 20l1.3-6.2L4 10l5.8-.8L12 4z",
  taraChatStudy: "M4 5h16v11H8l-4 4V5z",
  taraChatMotivate: "M12 3l2.2 5.2L20 10l-4.3 3.8L17 20l-5-3.2L7 20l1.3-6.2L4 10l5.8-.8L12 3z",
  taraChatPlan: "M7 4v3M17 4v3M5 8h14M6 6h12v14H6z",
  taraChatRevise: "M5 5h14v14H5zM8 9h8M8 13h8M8 17h5",
  taraChatConcept: "M12 4a5 5 0 00-3 9v3h6v-3a5 5 0 00-3-9zM9 20h6",
  taraChatAsk: "M9 9a3 3 0 116 0c0 2-3 2-3 5M12 18h.01",
  taraMoodGreat: "M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  taraMoodOkay: "M8 14h8M9 9h.01M15 9h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  taraMoodStressed: "M8 16s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  taraMoodTired: "M8 10h2M14 10h2M8 15h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  taraReflection: "M5 5h14v14H5zM8 9h8M8 13h6M8 17h4",
  me: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  spark: "M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z",
  check: "M5 13l4 4L19 7",
};

export function Icon({ name }: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
