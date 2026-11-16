type Section = { heading: string; body: string; subject: string };
const unit = /^(?:(?:mathematics|physics|chemistry|biology)\s+)?(?:units?|section|chapter)\s*[-–:]?\s*(?:\d+|[ivxlcdm]+\b)/i;
const subjectLine = /^(physics|chemistry|biology|mathematics)\b/i;
const ignored = new Set("the and with their from that this using solve apply find analyse describe understand identify into".split(" "));

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[’‘']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value: string) {
  return [...new Set(normalize(value).split(" ").filter((word) => word.length >= 3 && !ignored.has(word)))];
}

// Notices often contain years of eligibility rules and application forms on
// either side of the syllabus. Search only the marked syllabus in those files.
const ranges: Record<string, [RegExp, RegExp]> = {
  NDA: [/^B\. SYLLABUS OF THE EXAMINATION/im, /^APPENDIX\s*[-–]\s*II\b/im],
  UPSC_CSE: [/^SECTION III:\s*SYLLABI/im, /^APPENDIX\s*[-–]\s*II\b/im],
  SSC_CGL: [/^13\.10 Indicative Syllabus/im, /^14[.\s]/m],
  KEAM: [/^SYLLABUS FOR THE ENTRANCE EXAMINATIONS/im, /^ANNEXURE\s*[-–]\s*II\b/im],
  UCEED: [/^UCEED \d+ will have two parts/im, /^CONTACT US/im],
  CUET: [/^2\.6\.\s*Syllabus/im, /^(?:2\.7|CHAPTER\s*[-–]\s*3)/im],
  NATA: [/^NATA 2026 will be conducted as a comprehensive aptitude test/im, /^ELIGIBILITY CRITERIA/im],
  NIFT_ENTRANCE: [/^COMPONENTS OF THE ENTRANCE EXAMINATION/im, /^SEAT ALLOCATION/im],
};

const headings: Record<string, RegExp> = {
  SSC_CGL: /^13\.(10|11)[.\s]/,
  NDA: /^(?:\d+\.\s+[A-Z]|Part\s|Section\s)/i,
  UPSC_CSE: /^(?:Paper\s|General Studies|[A-Z][A-Z &-]{5,}$)/,
  UCEED: /^Part-[AB]/,
  CUET: /^2\.6/,
  CLAT: /^(?:English Language|Current Affairs, including General Knowledge|Legal Reasoning|Logical Reasoning|Quantitative Techniques)$/i,
  NIFT_ENTRANCE: /^(?:[iv]+\) |\d+\. (?:CREATIVE ABILITY|General Ability)|SITUATION TEST|PERSONAL INTERVIEWS|COMPONENTS OF)/i,
  NATA: /^(?:PART\s*[-–]\s*[AB]|A[123]\s*[-–]|Visual Reasoning Ability|Logical Derivation Ability|General Knowledge, Architecture|Language Interpretation Ability|Design Sensitivity and Thinking|Numerical Ability Basic)/i,
};

export function syllabusSections(raw: string, code: string): Section[] {
  let text = raw.replace(/\r/g, "");
  const range = ranges[code];
  if (range) {
    const start = text.search(range[0]);
    if (start < 0) return [];
    text = text.slice(start);
    const end = text.search(range[1]);
    if (end >= 0) text = text.slice(0, end);
  }
  if (["CAT", "IBPS_PO", "UGC_NET"].includes(code)) return [];
  const sections: Section[] = [];
  let subject = "";
  let heading = "";
  let lines: string[] = [];
  function finish() {
    if (heading && lines.some((line) => line.trim())) sections.push({ heading, body: [heading, ...lines].join("\n").trim(), subject });
    lines = [];
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    // Ignore PDF page furniture for matching. The entire original extraction
    // stays available in the document reader.
    if (/^(?:\d+$|File No\.|Generated from eOffice|DFA\/|4565948\/2025\/UGMEB|\d+\s+KEAM \d+©)/i.test(line)) continue;
    const subjectMatch = subjectLine.exec(line);
    if (subjectMatch && (line === subjectMatch[0] || unit.test(line))) {
      finish();
      subject = subjectMatch[1].toLowerCase();
      heading = "";
    }
    const advancedHeading = code === "JEE_ADVANCED" && line.length <= 75 && line.split(/\s+/).every(
      (word) => /^(?:[A-Z][A-Za-z-]*|[spdf]-Block|of|and|in|topics)[:,]?$/.test(word),
    );
    const boundary = unit.test(line) || headings[code]?.test(line) || advancedHeading;
    if (boundary) {
      finish();
      heading = line;
    } else {
      lines.push(rawLine);
    }
  }
  finish();
  return sections;
}

export function matchingSection(raw: string, code: string, title: string, chapter = "", description = "", subject = "") {
  const terms = words(title);
  const context = words(description);
  const chapterName = normalize(chapter);
  let best: { text: string; score: number } | null = null;
  for (const section of syllabusSections(raw, code)) {
    if (subject && section.subject && normalize(subject) !== section.subject) continue;
    const heading = normalize(section.heading);
    const body = normalize(section.body);
    const hits = terms.filter((term) => body.includes(term));
    const chapterMatch = chapterName.length >= 4 && heading.includes(chapterName);
    if (!chapterMatch && (!hits.length || hits.length * 2 < terms.length)) continue;
    const score = (chapterMatch ? 35 : 0) + hits.length * 8
      + hits.filter((term) => heading.includes(term)).length * 10
      + (body.includes(normalize(title)) ? 12 : 0) + context.filter((term) => body.includes(term)).length;
    if (!best || score > best.score) best = { text: section.body, score };
  }
  return best;
}
