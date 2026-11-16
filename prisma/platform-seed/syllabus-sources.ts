/**
 * Hand-verified extra pages that are worth importing on top of each exam's
 * `officialUrl`. Only add URLs that have been opened and confirmed to be
 * official. The importer records every fetch result, including failures.
 */
export type SyllabusSourceSeed = {
  examCode: string;
  label: string;
  url: string;
};

export const syllabusSourceSeeds: SyllabusSourceSeed[] = [
  {
    examCode: "UPSC_CSE",
    label: "UPSC — official syllabus page",
    url: "https://www.upsc.gov.in/examinations/syllabus",
  },
];
