# Official syllabus library

This folder is the local archive of official syllabus documents. Every file here
was downloaded from the exam authority itself (NTA, UPSC, SSC, IIM, IIT, CEE
Kerala, Consortium of NLUs, NIFT, NATA) and is kept next to the extracted text
so the question generator can quote a real source instead of inventing one.

```
syllabus/
  sources.json                  # exam -> official URL map
  <EXAM>/<document>.pdf|.html   # original document, unchanged (local only, git-ignored)
  <EXAM>/<document>.txt         # text extracted locally with pypdf
```

The original PDFs/HTML are large (about 50 MB together) and belong to the exam
authorities, so they are git-ignored. The URL manifest and the extracted text
are committed; `npm run syllabus:sync` restores the originals on any machine.

## How it works

```bash
npm run syllabus:sync                 # all sources
npm run syllabus:sync -- --exam=NEET  # one exam
npm run syllabus:sync -- --refetch    # re-download even if the file exists
```

The sync script:

1. downloads the document in `sources.json` (90 s timeout, browser user agent);
2. extracts text locally with `scripts/pdf_text.py` (pypdf), so no AI quota is used;
3. rejects an extraction shorter than 200 characters instead of storing noise;
4. upserts a `SyllabusSource` row (`IMPORTED` or `FAILED` with the reason) that
   the admin console and the question generator read.

## Authoring a paper from the archive

```bash
npm run generate:questions -- --exam=NEET
npm run generate:questions -- --exam=NEET --target=20 --batch=10 --dry-run
npm run generate:questions -- --exam=GATE_CS --official
npm run generate:questions -- --exam=JEE_MAIN --part=PAPER_1 --model=gemini-3.5-flash-lite
npm run verify:papers -- NEET
npm run questions:audit
npm run questions:dedupe -- --apply
```

The generator:

1. reads the real exam pattern and apportions the target across sections;
2. counts the reviewed bank per section and only writes the shortfall;
3. sends Gemini the section's official syllabus excerpts, the allowed topics,
   previously authored stems to avoid, and the required count;
4. rejects questions with anything other than four distinct options, a key
   outside 0–3, a weak explanation, or reasoning leakage ("Wait", "correct index");
5. rejects exact and near-duplicate stems against the whole bank;
6. links each question to its syllabus topic (or the official document in
   `--official` mode) and stores it as `AI_GENERATED` with a checksum;
7. stops cleanly on quota or repeated provider errors, so re-running resumes.

`--official` is for exams whose curated topic map does not match the official
document (currently GATE CS): the model works directly from the downloaded
syllabus and question topic IDs are left empty.

## Current coverage

All 16 exams have at least one official document and 17 documents were imported
with 0 failures. 15 exams now build a full objective paper; UGC NET Paper 2 is
blocked because the bulletin does not contain per-subject syllabi.

## Which exams have a real topic-wise syllabus?

| Exam | Official document | Topic-wise syllabus? |
| --- | --- | --- |
| NEET (UG) | NTA syllabus PDF | Yes |
| JEE Main | NTA syllabus PDF | Yes |
| JEE Advanced | jeeadv.ac.in syllabus PDF | Yes |
| GATE CS | IIT Guwahati syllabus PDF | Yes |
| KEAM | CEE Kerala prospectus, Annexure I | Yes |
| SSC CGL | SSC notice, section 13 | Yes (indicative) |
| UPSC CSE | UPSC notice, Section III | Yes |
| UPSC NDA | UPSC notice, Appendix I | Yes |
| UCEED | IIT Bombay syllabus page | Yes (topic areas) |
| CLAT | Consortium UG syllabus page | Yes (skill areas) |
| CUET (UG) | NTA syllabus page | Yes |
| UGC NET | NTA information bulletin | Yes (paper structure) |
| NIFT | NIFT prospectus, pages 131-136 | Yes |
| NATA | NATA brochure | Yes |
| CAT | IIM information bulletin | **No** - IIMs publish no topic list |
| IBPS PO | IBPS notification | **No** - IBPS publishes no topic list |

For CAT and IBPS PO the official document defines the pattern and marking only.
Their topic lists in the product must stay labelled as derived from previous
papers, never as an official syllabus.

## Copyright

The files are kept for internal question authoring and source citation. They are
not served to candidates as downloads; the product links to the official URL.
