/**
 * Curated links to official / openly licensed learning portals. The platform
 * never copies or hosts these documents; the student opens them on the
 * publisher's site, with the publisher and usage note shown alongside the link.
 *
 * Only sources that publish their own material are listed here. A link does not
 * imply a redistribution licence: the note says what the student may do.
 */

export type OfficialStudyResource = {
  title: string;
  url: string;
  publisher: string;
  kind: "Textbook" | "Portal" | "Video" | "Practice";
  note: string;
  subjects: string[];
};

const ALL_SCHOOL = ["PHYSICS", "CHEMISTRY", "BIOLOGY", "MATHEMATICS", "ENGLISH", "GENERAL_AWARENESS"];

const resources: OfficialStudyResource[] = [
  {
    title: "NCERT textbooks",
    url: "https://ncert.nic.in/textbook.php",
    publisher: "NCERT",
    kind: "Textbook",
    note: "Official NCERT textbook portal. Opens on ncert.nic.in; the book is not copied or hosted here.",
    subjects: ALL_SCHOOL,
  },
  {
    title: "ePathshala",
    url: "https://epathshala.nic.in/",
    publisher: "Ministry of Education, Government of India",
    kind: "Portal",
    note: "Official e-books and audio-visual material. Opens on epathshala.nic.in.",
    subjects: ALL_SCHOOL,
  },
  {
    title: "DIKSHA",
    url: "https://diksha.gov.in/",
    publisher: "Ministry of Education, Government of India",
    kind: "Portal",
    note: "National teacher and student learning platform. Resource-level licences vary; check the item page before reuse.",
    subjects: ["PHYSICS", "CHEMISTRY", "BIOLOGY", "MATHEMATICS", "ENGLISH", "GENERAL_AWARENESS", "COMPUTER_AWARENESS"],
  },
  {
    title: "SWAYAM",
    url: "https://swayam.gov.in/",
    publisher: "Ministry of Education, Government of India",
    kind: "Video",
    note: "Free government MOOCs. Course-level licences vary; the course page states the terms.",
    subjects: ["PHYSICS", "CHEMISTRY", "BIOLOGY", "MATHEMATICS", "COMPUTER_AWARENESS", "ENGINEERING_MATHEMATICS", "GENERAL_AWARENESS"],
  },
  {
    title: "NPTEL",
    url: "https://nptel.ac.in/",
    publisher: "IITs and IISc",
    kind: "Video",
    note: "Open engineering and science lectures. Opens on nptel.ac.in; videos are not re-hosted.",
    subjects: ["PHYSICS", "CHEMISTRY", "MATHEMATICS", "COMPUTER_AWARENESS", "ENGINEERING_MATHEMATICS"],
  },
  {
    title: "NCERT Exemplar problems",
    url: "https://ncert.nic.in/exemplar-problems.php",
    publisher: "NCERT",
    kind: "Practice",
    note: "Official exemplar questions. Opens on ncert.nic.in; answers are not copied into this platform.",
    subjects: ["PHYSICS", "CHEMISTRY", "BIOLOGY", "MATHEMATICS"],
  },
];

export function getOfficialStudyResources(subjectCode: string | null | undefined): OfficialStudyResource[] {
  if (!subjectCode) return [];
  return resources.filter((resource) => resource.subjects.includes(subjectCode));
}
