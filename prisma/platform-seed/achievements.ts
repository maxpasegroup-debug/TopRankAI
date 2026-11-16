import type { AchievementSeed } from "./types";

export const achievements: AchievementSeed[] = [
  { code: "FIRST_STEP", title: "First step", description: "Complete your first daily exam.", icon: "flag", metric: "TESTS_COMPLETED", threshold: 1, xp: 20 },
  { code: "WEEK_WARRIOR", title: "Week warrior", description: "Complete seven daily exams.", icon: "calendar", metric: "TESTS_COMPLETED", threshold: 7, xp: 80 },
  { code: "TEST_MARATHON", title: "Test marathon", description: "Complete thirty daily exams.", icon: "medal", metric: "TESTS_COMPLETED", threshold: 30, xp: 250 },
  { code: "STREAK_3", title: "Three in a row", description: "Maintain a three-day study streak.", icon: "flame", metric: "STREAK", threshold: 3, xp: 30 },
  { code: "STREAK_7", title: "Seven-day rhythm", description: "Maintain a seven-day study streak.", icon: "flame", metric: "STREAK", threshold: 7, xp: 90 },
  { code: "STREAK_30", title: "Unbroken month", description: "Maintain a thirty-day study streak.", icon: "flame", metric: "STREAK", threshold: 30, xp: 400 },
  { code: "ACCURACY_70", title: "Finding the line", description: "Reach 70% accuracy across your attempts.", icon: "target", metric: "ACCURACY", threshold: 70, xp: 50 },
  { code: "ACCURACY_85", title: "Sharp shooter", description: "Reach 85% accuracy across your attempts.", icon: "target", metric: "ACCURACY", threshold: 85, xp: 150 },
  { code: "ACCURACY_95", title: "Near perfect", description: "Reach 95% accuracy across your attempts.", icon: "target", metric: "ACCURACY", threshold: 95, xp: 300 },
  { code: "QUESTIONS_50", title: "Fifty solved", description: "Answer fifty questions across daily exams.", icon: "check", metric: "QUESTIONS_SOLVED", threshold: 50, xp: 40 },
  { code: "QUESTIONS_250", title: "Two hundred and fifty", description: "Answer two hundred and fifty questions.", icon: "check", metric: "QUESTIONS_SOLVED", threshold: 250, xp: 200 },
  { code: "SYLLABUS_10", title: "Syllabus explorer", description: "Study ten syllabus topics.", icon: "book", metric: "SYLLABUS_TOPICS", threshold: 10, xp: 60 },
  { code: "SYLLABUS_50", title: "Syllabus builder", description: "Study fifty syllabus topics.", icon: "book", metric: "SYLLABUS_TOPICS", threshold: 50, xp: 240 },
  { code: "PERFECT_SCORE", title: "Perfect paper", description: "Score full marks on a daily exam.", icon: "star", metric: "PERFECT_SCORE", threshold: 1, xp: 120 },
];
