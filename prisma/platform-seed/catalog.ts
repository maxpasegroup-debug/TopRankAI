/**
 * Curated catalogue for the TopRank AI exam platform.
 *
 * Exam names, official links and paper structures are editorial data. They are
 * published with a "verify on the official website" note and remain editable in
 * the admin workspace. No exam dates are invented anywhere in this file.
 */

export type CategorySeed = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
};

export type ExamSeed = {
  code: string;
  name: string;
  shortName: string;
  categorySlug: string;
  description: string;
  officialUrl: string;
  durationMinutes: number;
  totalQuestions: number;
  positiveMarks: number;
  negativeMarks: number;
  questionTypes: string[];
  dailyTestQuestions: number;
  dailyTestMinutes: number;
  markingNote: string;
  subjects: string[];
  defaultLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXTREME";
};

export const categories: CategorySeed[] = [
  { name: "Engineering & Technology", slug: "engineering-technology", description: "Engineering entrances, technology admissions and graduate aptitude tests.", icon: "compass", color: "indigo", order: 1 },
  { name: "Medical & Health", slug: "medical-health", description: "Medical, dental, nursing and allied-health entrance pathways.", icon: "pulse", color: "rose", order: 2 },
  { name: "University Admissions", slug: "university-admissions", description: "Central, state and deemed university entrance examinations.", icon: "cap", color: "violet", order: 3 },
  { name: "Civil Services & Government", slug: "civil-services-government", description: "UPSC, state PSC, SSC and public recruitment examinations.", icon: "landmark", color: "amber", order: 4 },
  { name: "Law", slug: "law", description: "National law university and legal aptitude entrance examinations.", icon: "scales", color: "slate", order: 5 },
  { name: "Management", slug: "management", description: "MBA, PGDM and management aptitude entrance examinations.", icon: "chart", color: "cyan", order: 6 },
  { name: "Banking & Insurance", slug: "banking-insurance", description: "Bank PO, clerk and insurance sector recruitment examinations.", icon: "bank", color: "teal", order: 7 },
  { name: "Defence", slug: "defence", description: "National defence academy, combined defence and armed forces entries.", icon: "shield", color: "orange", order: 8 },
  { name: "Design & Architecture", slug: "design-architecture", description: "Design aptitude, architecture and creative entrance examinations.", icon: "pen", color: "pink", order: 9 },
  { name: "Teaching & Research", slug: "teaching-research", description: "Lectureship, research eligibility and academic aptitude examinations.", icon: "book", color: "blue", order: 10 },
];

export const subjectCatalogue = [
  { code: "PHYSICS", name: "Physics", slug: "physics" },
  { code: "CHEMISTRY", name: "Chemistry", slug: "chemistry" },
  { code: "BIOLOGY", name: "Biology", slug: "biology" },
  { code: "MATHEMATICS", name: "Mathematics", slug: "mathematics" },
  { code: "ENGLISH", name: "English Language", slug: "english" },
  { code: "LOGICAL_REASONING", name: "Logical Reasoning", slug: "logical-reasoning" },
  { code: "QUANTITATIVE_APTITUDE", name: "Quantitative Aptitude", slug: "quantitative-aptitude" },
  { code: "GENERAL_AWARENESS", name: "General Awareness", slug: "general-awareness" },
  { code: "LEGAL_REASONING", name: "Legal Reasoning", slug: "legal-reasoning" },
  { code: "DESIGN_APTITUDE", name: "Design Aptitude", slug: "design-aptitude" },
  { code: "COMPUTER_AWARENESS", name: "Computer Awareness", slug: "computer-awareness" },
  { code: "ENGINEERING_MATHEMATICS", name: "Engineering Mathematics", slug: "engineering-mathematics" },
] as const;

export const exams: ExamSeed[] = [
  {
    code: "JEE_MAIN", name: "JEE Main", shortName: "JEE Main", categorySlug: "engineering-technology",
    description: "National engineering entrance for admission to NITs, IIITs and other centrally funded technical institutions. The daily loop mixes Physics, Chemistry and Mathematics.",
    officialUrl: "https://jeemain.nta.nic.in/", durationMinutes: 180, totalQuestions: 75,
    positiveMarks: 4, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE", "NUMERICAL"],
    dailyTestQuestions: 8, dailyTestMinutes: 16,
    markingNote: "Paper 1 style: +4 for a correct answer, -1 for an incorrect answer, 0 for unanswered. Verify the current information bulletin for numerical-question rules.",
    subjects: ["PHYSICS", "CHEMISTRY", "MATHEMATICS"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "JEE_ADVANCED", name: "JEE Advanced", shortName: "JEE Advanced", categorySlug: "engineering-technology",
    description: "The second stage of the JEE pathway for admission to the Indian Institutes of Technology. Practice emphasises multi-concept problems and time discipline.",
    officialUrl: "https://jeeadv.ac.in/", durationMinutes: 180, totalQuestions: 54,
    positiveMarks: 4, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"],
    dailyTestQuestions: 8, dailyTestMinutes: 20,
    markingNote: "Marking varies by section in the official paper. This workspace uses a transparent +4 / -1 practice model unless an administrator changes it.",
    subjects: ["PHYSICS", "CHEMISTRY", "MATHEMATICS"], defaultLevel: "ADVANCED",
  },
  {
    code: "NEET", name: "NEET (UG)", shortName: "NEET", categorySlug: "medical-health",
    description: "Single national entrance examination for undergraduate medical, dental and allied health courses. The daily loop covers Physics, Chemistry and Biology.",
    officialUrl: "https://neet.nta.nic.in/", durationMinutes: 180, totalQuestions: 180,
    positiveMarks: 4, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 10, dailyTestMinutes: 18,
    markingNote: "Standard NEET pattern: +4 for correct, -1 for incorrect, 0 for unanswered. Verify the current information bulletin.",
    subjects: ["PHYSICS", "CHEMISTRY", "BIOLOGY"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "CUET", name: "CUET (UG)", shortName: "CUET", categorySlug: "university-admissions",
    description: "Common University Entrance Test for undergraduate admissions across participating central and state universities.",
    officialUrl: "https://cuet.nta.nic.in/", durationMinutes: 60, totalQuestions: 50,
    positiveMarks: 5, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 12,
    markingNote: "Per-question marking differs by section in the official examination. Practice uses +5 / -1 by default; edit it in the admin workspace.",
    subjects: ["ENGLISH", "QUANTITATIVE_APTITUDE", "LOGICAL_REASONING", "GENERAL_AWARENESS"], defaultLevel: "BEGINNER",
  },
  {
    code: "KEAM", name: "KEAM", shortName: "KEAM", categorySlug: "engineering-technology",
    description: "Kerala Engineering Architecture Medical entrance examination for state professional-course admissions.",
    officialUrl: "https://cee.kerala.gov.in/", durationMinutes: 150, totalQuestions: 150,
    positiveMarks: 4, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 15,
    markingNote: "Practice model: +4 / -1. Check the current CEE Kerala prospectus for the applicable marking scheme.",
    subjects: ["PHYSICS", "CHEMISTRY", "MATHEMATICS"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "CLAT", name: "CLAT", shortName: "CLAT", categorySlug: "law",
    description: "Common Law Admission Test for integrated law programmes at participating National Law Universities.",
    officialUrl: "https://consortiumofnlus.ac.in/", durationMinutes: 120, totalQuestions: 120,
    positiveMarks: 1, negativeMarks: 0.25, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 12,
    markingNote: "Standard model: +1 for correct, -0.25 for incorrect. Confirm the current notification.",
    subjects: ["ENGLISH", "LOGICAL_REASONING", "LEGAL_REASONING", "GENERAL_AWARENESS", "QUANTITATIVE_APTITUDE"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "CAT", name: "CAT", shortName: "CAT", categorySlug: "management",
    description: "Common Admission Test for Indian Institute of Management and other management programmes.",
    officialUrl: "https://iimcat.ac.in/", durationMinutes: 120, totalQuestions: 66,
    positiveMarks: 3, negativeMarks: 1, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 16,
    markingNote: "Practice model: +3 / -1 for multiple-choice questions. Some questions are non-MCQ and carry no penalty.",
    subjects: ["QUANTITATIVE_APTITUDE", "LOGICAL_REASONING", "ENGLISH", "GENERAL_AWARENESS"], defaultLevel: "ADVANCED",
  },
  {
    code: "UPSC_CSE", name: "UPSC Civil Services Examination", shortName: "UPSC CSE", categorySlug: "civil-services-government",
    description: "Preliminary and main examination for the Indian Administrative, Police, Foreign and other civil services.",
    officialUrl: "https://upsc.gov.in/examinations/active-exams", durationMinutes: 120, totalQuestions: 100,
    positiveMarks: 2, negativeMarks: 0.66, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 12,
    markingNote: "Preliminary General Studies model: +2 / -0.66. Confirm the current UPSC notification.",
    subjects: ["GENERAL_AWARENESS", "LOGICAL_REASONING", "QUANTITATIVE_APTITUDE", "ENGLISH"], defaultLevel: "ADVANCED",
  },
  {
    code: "SSC_CGL", name: "SSC Combined Graduate Level", shortName: "SSC CGL", categorySlug: "civil-services-government",
    description: "Staff Selection Commission graduate-level recruitment examination for central government posts.",
    officialUrl: "https://ssc.gov.in/", durationMinutes: 60, totalQuestions: 100,
    positiveMarks: 2, negativeMarks: 0.5, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 12,
    markingNote: "Tier-I model: +2 / -0.5. Confirm the current SSC notice.",
    subjects: ["QUANTITATIVE_APTITUDE", "LOGICAL_REASONING", "ENGLISH", "GENERAL_AWARENESS"], defaultLevel: "BEGINNER",
  },
  {
    code: "IBPS_PO", name: "IBPS Probationary Officer", shortName: "IBPS PO", categorySlug: "banking-insurance",
    description: "Banking personnel selection examination for probationary officer posts in participating public-sector banks.",
    officialUrl: "https://www.ibps.in/", durationMinutes: 60, totalQuestions: 100,
    positiveMarks: 1, negativeMarks: 0.25, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 10,
    markingNote: "Preliminary model: +1 / -0.25. Confirm the current IBPS notification.",
    subjects: ["QUANTITATIVE_APTITUDE", "LOGICAL_REASONING", "ENGLISH", "COMPUTER_AWARENESS", "GENERAL_AWARENESS"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "NDA", name: "UPSC NDA & NA", shortName: "NDA", categorySlug: "defence",
    description: "National Defence Academy and Naval Academy examination for officer-cadet entry into the armed forces.",
    officialUrl: "https://upsc.gov.in/examinations/active-exams", durationMinutes: 150, totalQuestions: 120,
    positiveMarks: 4, negativeMarks: 1.33, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 14,
    markingNote: "Mathematics paper model: +4 / -1.33. Confirm the current UPSC notification.",
    subjects: ["MATHEMATICS", "GENERAL_AWARENESS", "ENGLISH"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "UGC_NET", name: "UGC NET", shortName: "UGC NET", categorySlug: "teaching-research",
    description: "National eligibility test for lectureship and Junior Research Fellowship across Indian universities.",
    officialUrl: "https://ugcnet.nta.ac.in/", durationMinutes: 180, totalQuestions: 150,
    positiveMarks: 2, negativeMarks: 0, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 14,
    markingNote: "General test practice model: +2, no negative marking. Paper structure and subject syllabi vary.",
    subjects: ["GENERAL_AWARENESS", "LOGICAL_REASONING", "ENGLISH", "COMPUTER_AWARENESS"], defaultLevel: "ADVANCED",
  },
  {
    code: "NATA", name: "NATA", shortName: "NATA", categorySlug: "design-architecture",
    description: "National Aptitude Test in Architecture for undergraduate architecture admissions.",
    officialUrl: "https://www.nata.in/", durationMinutes: 180, totalQuestions: 125,
    positiveMarks: 1, negativeMarks: 0, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 14,
    markingNote: "Practice model: +1, no negative marking. Confirm the current Council of Architecture notification.",
    subjects: ["MATHEMATICS", "GENERAL_AWARENESS", "DESIGN_APTITUDE"], defaultLevel: "BEGINNER",
  },
  {
    code: "UCEED", name: "UCEED", shortName: "UCEED", categorySlug: "design-architecture",
    description: "Undergraduate Common Entrance Examination for Design for admission to IIT design programmes.",
    officialUrl: "https://www.uceed.iitb.ac.in/", durationMinutes: 180, totalQuestions: 60,
    positiveMarks: 3, negativeMarks: 0.6, questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 18,
    markingNote: "Practice model: +3 / -0.6. Section-wise marking varies in the official paper.",
    subjects: ["DESIGN_APTITUDE", "LOGICAL_REASONING", "QUANTITATIVE_APTITUDE", "GENERAL_AWARENESS"], defaultLevel: "INTERMEDIATE",
  },
  {
    code: "NIFT_ENTRANCE", name: "NIFT Entrance Examination", shortName: "NIFT", categorySlug: "design-architecture",
    description: "National Institute of Fashion Technology entrance for design and technology programmes.",
    officialUrl: "https://exams.nta.ac.in/NIFT/", durationMinutes: 120, totalQuestions: 100,
    positiveMarks: 1, negativeMarks: 0, questionTypes: ["SINGLE_CHOICE"],
    dailyTestQuestions: 8, dailyTestMinutes: 12,
    markingNote: "Practice model: +1, no negative marking. Confirm the current NIFT prospectus.",
    subjects: ["DESIGN_APTITUDE", "GENERAL_AWARENESS", "QUANTITATIVE_APTITUDE", "ENGLISH"], defaultLevel: "BEGINNER",
  },
  {
    code: "GATE_CS", name: "GATE Computer Science", shortName: "GATE CS", categorySlug: "engineering-technology",
    description: "Graduate Aptitude Test in Engineering, Computer Science and Information Technology paper.",
    officialUrl: "https://gate.iitk.ac.in/", durationMinutes: 180, totalQuestions: 65,
    positiveMarks: 2, negativeMarks: 0.66, questionTypes: ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL"],
    dailyTestQuestions: 8, dailyTestMinutes: 20,
    markingNote: "Practice model: +1 or +2 depending on question weight with one-third negative marking. Verify the current GATE paper pattern.",
    subjects: ["ENGINEERING_MATHEMATICS", "COMPUTER_AWARENESS", "QUANTITATIVE_APTITUDE", "LOGICAL_REASONING"], defaultLevel: "ADVANCED",
  },
];
