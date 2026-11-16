export { categories, exams, subjectCatalogue } from "./catalog";
export type { CategorySeed, ExamSeed } from "./catalog";
export { examPatterns } from "./patterns";
export { physics, chemistry, biology } from "./syllabus-core";
export { syllabusBySubject } from "./syllabus-library";
export type { UnitSeed, ChapterSeed, TopicSeed } from "./syllabus-core";
export { scienceQuestions } from "./questions-science";
export { aptitudeQuestions } from "./questions-aptitude";
export { generatedQuestions } from "./questions-generated";
export { achievements } from "./achievements";
export type { QuestionSeed } from "./types";

import { scienceQuestions } from "./questions-science";
import { aptitudeQuestions } from "./questions-aptitude";
import { generatedQuestions } from "./questions-generated";

export const allQuestions = [...scienceQuestions, ...aptitudeQuestions, ...generatedQuestions];
