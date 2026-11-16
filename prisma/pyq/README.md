# Previous-year question (PYQ) intake

The platform does **not** copy question text out of copyrighted papers
automatically. Use this folder to stage structured questions that a human has
transcribed from an official paper, then import them as review drafts.

## 1. Stage a file

Copy `template.json` and fill in real questions. Every question needs:

| Field | Required | Notes |
| --- | --- | --- |
| `year` | yes | The official paper year. |
| `subjectCode` | yes | One of the subject codes in the catalogue, e.g. `PHYSICS`, `QUANTITATIVE_APTITUDE`. |
| `topic` | no | A syllabus topic title; matched inside the exam's syllabus. |
| `type` | no | `SINGLE_CHOICE` (default), `MULTIPLE_CHOICE` or `NUMERICAL`. |
| `difficulty` | no | `EASY`, `MEDIUM` (default) or `HARD`. |
| `text` | yes | The question stem. |
| `options` | yes for MCQ | `{ "text": "...", "correct": true }`; exactly one correct for single choice. |
| `numericalAnswer` | yes for numerical | The accepted value. |
| `explanation` | no | A short, original explanation. |
| `sourceUrl` | no | The official paper URL, if you have it. |

## 2. Dry run

```bash
npx tsx scripts/import-pyq.ts --file=prisma/pyq/my-questions.json
```

## 3. Import

```bash
npx tsx scripts/import-pyq.ts --file=prisma/pyq/my-questions.json --apply
```

Imported questions are created as `DRAFT` + `NEEDS_REVIEW` with
`sourceType = PREVIOUS_YEAR`. They do not enter a paper until an administrator
approves them.

## 4. Capturing official paper documents

`scripts/import-syllabus.ts` also stores official documents linked from each
exam's official website (syllabus pages, information bulletins, previous-year
paper pages) in `SyllabusSource`. PDFs are transcribed by the configured Gemini
model and every row keeps its source URL and an `IMPORTED`/`FAILED` status.
