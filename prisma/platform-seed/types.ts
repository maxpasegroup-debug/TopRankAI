export type QuestionOptionSeed = {
  code: string;
  text: string;
  correct?: boolean;
};

export type QuestionSeed = {
  code: string;
  text: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMERICAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  subject: string;
  topicSlug: string;
  options: QuestionOptionSeed[];
  numericalAnswer?: string;
  explanation: string;
  sourceType: "SEED" | "PREVIOUS_YEAR" | "ADMIN_CREATED";
  sourceYear?: number;
  tags: string[];
};

export type AchievementSeed = {
  code: string;
  title: string;
  description: string;
  icon: string;
  metric: "TESTS_COMPLETED" | "STREAK" | "ACCURACY" | "QUESTIONS_SOLVED" | "SYLLABUS_TOPICS" | "PERFECT_SCORE" | "MOCK_COMPLETED";
  threshold: number;
  xp: number;
};
