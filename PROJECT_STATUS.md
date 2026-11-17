# TopRank AI — Project Status

Updated: 2026-11-16 (IST)  
Working branch: `feature/ai-exam-platform` (not merged into `main`)

## What this product is

TopRank AI is an India-focused competitive-exam preparation platform for 16 pathways (engineering, medical, law, management, civil services, banking, defence, design, teaching and university admissions). A candidate can prepare for several exams in parallel, each with its own target year, preparation level, paper variant, daily time budget, syllabus, analytics and revision history.

The core loop is deliberately concrete:

1. Pick exams, a paper variant and a separate preparation level for each one.
2. Receive one deterministic, server-assembled daily paper that follows the exam's real official pattern.
3. Submit it and get objective marks, accuracy, negative-marking and per-section/subject/topic breakdowns calculated on the server.
4. Review every question with the correct answer and a “revise the syllabus” link to the topic behind it.
5. Practise again, complete syllabus topics, build a streak, unlock achievements and track readiness.

The UI is an original indigo/violet and coral design, not the previous green/lime theme. Light, dark and system themes cycle from one icon in the top-right of the navbar. Coloured action buttons use white text in every theme.

## Technology

- **Framework:** Next.js 16 App Router, React 19, TypeScript.
- **Database:** PostgreSQL on Neon, accessed with Prisma 7 and `@prisma/adapter-pg`.
- **Authentication:** first-party session cookies, `bcryptjs` password hashing, role-gated server components and server actions. Candidate and administrator authentication are separate.
- **UI:** CSS design tokens and components in `src/styles/platform.css`; Bricolage Grotesque + Plus Jakarta Sans, vendored under `src/app/fonts/` so builds and requests do not depend on Google Fonts being reachable; GSAP reveal motion on public pages with reduced-motion support.
- **Tailwind CSS v4:** installed alongside the existing tokens and used for new components, with a staged migration in progress. Preflight is intentionally skipped so the current look is unchanged; `src/styles/tailwind.css` sets the layer order and imports the legacy stylesheet into `components`, which lets utilities override `tp-*` classes.
- **File storage:** Cloudinary signed uploads for images, with Cloudflare R2 (`@aws-sdk/client-s3`) kept as the production alternative. Both are proxied through a Next.js route handler, so credentials never reach the browser; `STORAGE_PROVIDER` pins the active backend, otherwise Cloudinary is preferred and R2 is used when only R2 is configured.
- **Validation:** Zod schemas shared by UI payloads, server actions and importers. State → District choices are validated server-side against a generated district dataset.
- **AI:** Google Gemini through the REST API (`src/server/ai/gemini.ts`), with JSON response schemas, bounded retries and timeouts, and an `AIUsageLog` audit trail.

## Run locally

```bash
npm install

# .env (never commit this file)
DATABASE_URL="postgresql://..."
# Optional AI configuration:
# GEMINI_API_KEY="..."
# GEMINI_MODEL="gemini-3.5-flash"
# AI_FEATURES_ENABLED="true"
# Optional file uploads (Cloudinary). Leave blank to disable uploads:
# CLOUDINARY_CLOUD_NAME="..."
# CLOUDINARY_API_KEY="..."
# CLOUDINARY_API_SECRET="..."
# STORAGE_PROVIDER="cloudinary"   # or "r2" once an R2 bucket exists

npm run prisma:generate
npm run prisma:deploy     # apply forward migrations
npm run db:seed           # curated exam catalogue, patterns, syllabus, questions, achievements
npm run dev               # http://localhost:3000
```

Useful checks and tools:

```bash
npm run typecheck
npm run import:syllabus -- --exam=JEE_MAIN          # fetch official syllabus / bulletin
npm run import:pyq -- prisma/pyq/your-file.json     # dry run; add --apply to write drafts
npm run syllabus:sync                               # download + extract every official syllabus document
npm run generate:questions -- --exam=NEET           # author a full paper from the imported syllabus
npm run generate:questions -- --exam=NEET --target=20 --batch=10 --dry-run
npm run verify:papers                               # build one paper per exam for a throwaway candidate
npm run generate:notes -- --exam=NEET               # detailed topic notes from the official syllabus
npm run notes:share -- --apply                      # reuse a note for the same subject/topic in other exams
npm run questions:audit                             # find keys that contradict their own explanation
npm run questions:dedupe -- --apply                 # archive duplicate stems and move their exam links
npm run districts:sync                              # regenerate the State → District dataset
npm run db:reset-candidates                         # report every non-admin account
npm run db:reset-candidates --apply                 # delete them, keeping administrators
```

Prisma 7 commands in this repository use `--config prisma7.config.ts`. `prisma migrate dev` can time out against the remote Neon database; the reliable route used here is:

```bash
npx prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --script
npx prisma migrate deploy --config prisma7.config.ts
```

## The daily paper engine

Every exam carries its real official pattern, not a generic daily size.

- **Pattern storage.** `ExamConfiguration.sections` holds `{ parts: [...], note }`. Each part has a code, name, duration, total questions, total marks, marking rules and section definitions (section name, subject code, question count, marks per question, negative marks, MCQ/numerical mix).
- **Part selection.** Multi-paper exams (JEE Main Paper 1 / 2A / 2B, JEE Advanced Paper 1 / 2, CUET papers, NIFT programmes) are chosen at registration and in My Exams. The choice is stored in `CandidateExamTarget.examPart` and drives the pattern shown and the paper built.
- **Daily papers.** The preparation level sets how many papers the candidate sits in a day (1–4), and `DailyExam` is unique on `(userId, examId, scheduledDate, slot)`. Every sitting uses the complete official pattern: same question count, duration, marks and negative marking. A 10-day recency window rotates questions and avoids repeating the same items too often.
- **Full mock vs practice set is decided honestly.** If the reviewed pool covers the part's official total, every slot is a `FULL_MOCK` with the official question count, official duration and per-section marks. A follow-up paper is never shortened to 60 minutes/60 questions. Otherwise the paper is a `PRACTICE_SET` sized at roughly half the official paper (never below the admin-configured practice floor, never beyond the pool), and the UI states exactly how many official questions it covers.
- **Study time is separate from exam time.** `CandidateExamTarget.dailyMinutes` is the candidate's syllabus/revision target, set per exam (level defaults 30/45/90/120; editable in My Exams). It is not derived from paper duration. Paper time is shown separately as `papersPerDay × official duration`. The current MINUTES goal still advances from submitted-paper time; the recommended next model is to track syllabus study sessions and derive the target from remaining topic effort ÷ days to exam.
- **Daily workload, start times and mock monthly.** Levels include 1–4 papers/day. A candidate can choose up to 8; papers above the level allowance require the mock monthly plan. The upgrade is a clearly labelled test checkout (`MOCK_MONTHLY`, 30 days, no payment gateway, no card data, no money charged). `/app/daily` has one consolidated schedule card: every exam in the plan has its own papers/day control and IST start time. Later papers follow after a 45-minute break. Study minutes stay editable per exam in My Exams, separately from exam start times.
- **Coverage is stored, not implied.** Each paper's snapshot records mode, official total, official marks, duration, section quotas and selected counts, plus the per-question section and marks used for scoring.
- **Deterministic scoring.** Marks, negative marking, accuracy, score percentage and subject/topic breakdowns come from the stored answer key and the paper snapshot. AI never computes an objective score.

Examples from the current bank (verified by direct engine calls):

| Exam | Official paper | Current daily paper |
| --- | --- | --- |
| NEET (UG) | 180 Q / 180 min / 720 marks | Full mock, 180 Q / 180 min / 720 marks (45 Physics + 45 Chemistry + 90 Biology) |
| JEE Main Paper 1 | 75 Q / 180 min / 300 marks | Full mock, 75 Q / 180 min / 300 marks |
| JEE Advanced Paper 1 | 48 Q / 180 min / 180 marks | Full mock, 48 Q / 180 min |
| JEE Advanced Paper 2 | 54 Q / 180 min / 180 marks | Full mock, 54 Q / 180 min |
| KEAM | 150 Q / 180 min / 600 marks | Full mock, 150 Q / 180 min |
| CLAT | 120 Q / 120 min / 120 marks | Full mock, 120 Q / 120 min |
| CUET (UG) Language | 50 Q / 60 min / 250 marks | Full mock, 50 Q / 60 min |
| CAT | 68 Q / 120 min / 204 marks | Full mock, 68 Q / 120 min |
| GATE CS | 65 Q / 180 min / 100 marks | Full mock, 65 Q / 180 min |
| SSC CGL Tier I | 100 Q / 60 min / 200 marks | Full mock, 100 Q / 60 min |
| IBPS PO Prelims | 100 Q / 60 min / 100 marks | Full mock, 100 Q / 60 min |
| UPSC CSE Prelims GS | 100 Q / 120 min / 200 marks | Full mock, 100 Q / 120 min |
| NDA Paper 1 (Mathematics) | 120 Q / 150 min / 300 marks | Full mock, 120 Q / 150 min |
| NDA Paper 2 (GAT) | 150 Q / 150 min / 600 marks | Full mock, 150 Q / 150 min |
| NIFT Entrance (GAT) | 101 Q / 120 min / 200 marks | Full mock, 101 Q / 120 min |
| NATA | 53 Q / 180 min / 200 marks | Full mock, 53 Q / 180 min |
| UCEED | 59 Q / 180 min / 300 marks | Full mock, 59 Q / 180 min |
| UGC NET | 150 Q / 180 min / 300 marks | **Practice set**, Paper 1 only; Paper 2 needs a subject choice |

The exam catalogue, exam detail page, registration wizard, plan editor, planner, dashboard and daily pages all advertise the official paper size rather than the old 8-question daily count. "Practice set floor" is labelled as an administrator-configured minimum, not the advertised paper.

Multi-paper coverage: JEE Main Paper 1, JEE Advanced Paper 1 and Paper 2, and NDA Paper 1 and Paper 2 are full mocks. JEE Main Paper 2A (B.Arch) and Paper 2B (B.Planning) are **not** full: their Aptitude/Planning sections have no topic map in the current syllabus catalogue, so those sections stay empty and the paper is labelled a practice set rather than filled with unrelated Mathematics questions.

## AI setup and boundaries

AI is optional. Without a key the application still works end to end and labels every deterministic fallback.

1. Create a free Google AI Studio key: <https://aistudio.google.com/app/apikey>.
2. Add `GEMINI_API_KEY=...` to `.env` and restart `npm run dev`.
3. Override the model with `GEMINI_MODEL` if needed (default `gemini-3.5-flash`).
4. Set `AI_FEATURES_ENABLED=false` to disable all AI calls without deleting the key.

AI is used for:

- Narrative feedback after a submitted paper.
- Detailed study notes for a syllabus topic, anchored to the official syllabus excerpt. Notes are generated in chapter batches by `scripts/generate-notes.ts`, stored as a clearly labelled `StudyMaterial` row, and reused across exams when the subject and topic match.
- A suggested study plan from recorded weak topics.
- Draft practice questions written from a syllabus topic, anchored to official syllabus excerpts when available.
- Batch authoring of full-length papers (`scripts/generate-questions.ts`), one section at a time, against the downloaded official syllabus.
- Draft official paper patterns/sections for an exam, always saved as "needs verification".

AI is **not** used for marks, accuracy, negative marking, score percentages, streaks, readiness totals or achievements. Those are deterministic server calculations from the stored answer key and recorded activity. Interactive drafts created in the admin console are `NEEDS_REVIEW` and do not enter a live paper until an administrator approves them. Batch-authored questions are written by `generate-questions.ts`, pass structural validation (four distinct options, one key in range, non-empty explanation), a reasoning-leak filter, exact and near-duplicate rejection against the whole bank, and a deterministic key audit; they are stored as `sourceType: AI_GENERATED` with the model name and date in `source`, and are labelled as AI-authored in the database. Every AI call is recorded in `AIUsageLog`.

### Feedback reliability

- Every AI task now sends a JSON `responseSchema`, so the model returns the expected shape instead of prose that has to be guessed at.
- Each call has a per-task timeout, bounded retry count and output-token cap. Feedback, for example, uses a single attempt, a 15-second timeout and 1,200 output tokens; Gemini is configured with a low thinking level to keep latency down.
- Feedback is normalised tolerantly (aliases, string-to-array coercions, repaired focus areas) before validation.
- Submission never fails because of AI. If the provider errors, times out or quota-limits, the result is committed, deterministic feedback is generated from the recorded numbers, and the page says AI commentary is unavailable rather than implying a key is missing.
- Deterministic feedback is regenerated on view when the stored source is not AI, so weakest topics/subjects always match the current resolved review.

**Current provider state:** the Gemini key works. Batch authoring ran on `gemini-3.5-flash-lite` because the `gemini-3.5-flash` free-tier bucket returned `429` with "limit: 20" on an earlier probe; Flash Lite kept serving and authored the banks below. Transient `503` "high demand" responses occurred and were retried by rerunning the generator. Quota is still the limiting factor for authoring all remaining subjects, so generation stays a resumable command rather than an automatic job.

## Official syllabus and previous-year question intake

There is **no single free, official, machine-readable API** for the syllabus and calendar of every Indian competitive exam. Sources are fragmented across commission and university websites, PDF notifications and state portals. The product therefore never invents content.

### Syllabus sources (`SyllabusSource`)

- `scripts/sync-syllabus-library.ts` (npm run syllabus:sync) downloads each document named in `syllabus/sources.json`, keeps the original PDF/HTML under `syllabus/<EXAM>/`, and extracts text locally with `scripts/pdf_text.py` (pypdf). Local extraction uses no AI quota, strips NTA surrogate glyphs that cannot be stored as UTF-8, and rejects an extraction shorter than 200 characters instead of storing navigation noise.
- **17 official documents across all 16 exams are downloaded and extracted, with 0 failures.** NEET 41,756 characters, JEE Main 39,786, JEE Advanced 24,188, GATE CS 3,141, KEAM 501,496, SSC CGL 210,007, UPSC CSE 372,420, NDA 236,111, CUET 123,881, IBPS PO 139,448, UGC NET 125,964, CAT 14,208, NATA 46,216, CLAT 5,153, UCEED 2,104, NIFT 133,041 + 282,543.
- `getOfficialSyllabusExcerpt` scores keyword and title matches, cuts a window around the best match aligned to the nearest section heading, and returns up to three excerpts with their source URLs. It returns `null` when nothing matches; it never fabricates an excerpt. Coverage on the NEET catalogue is 97 of 102 topics; the five misses fall back to curated notes and are disclosed on the topic page.
- The learning centre now shows the matched official passage on `/app/learn/[topicId]`, with the source label and a link to the original document, plus an honest "no close match" message when the document does not contain the topic.
- The excerpt is injected into AI question authoring and study-note prompts, so generated material stays anchored to a real official document.
- `/admin/syllabus` shows import status per exam: imported/failed counts, format, source URL, fetch date and any recorded error.
- **CAT and IBPS PO have no officially published topic-wise syllabus.** Only their official pattern/notification documents are stored, and questions for them are labelled as authored from the curated topic map rather than from an official topic list.
- **UGC NET Paper 2 is subject-specific.** The bulletin describes the paper structure but not each subject's syllabus, so the bank currently covers Paper 1 only. The same limitation blocks a full UGC NET paper.
- The `syllabus/` archive keeps the originals for internal authoring and citation. They are not served to candidates; the product links to the official URL.

### Previous-year questions

- `scripts/import-pyq.ts` imports a structured JSON file (`prisma/pyq/template.json`, documented in `prisma/pyq/README.md`) into `PREVIOUS_YEAR` questions, links them to the exam, computes a checksum for duplicate detection and writes them as `DRAFT` / `NEEDS_REVIEW`. It is a dry run unless `--apply` is passed.
- Questions imported this way require human approval before entering a paper, exactly like AI drafts.
- Automatic extraction of questions from PDFs is intentionally not implemented: it is unreliable and copyright-sensitive. A human supplies the structured file.

## What is built

### Public site

- `/` — product landing page with real catalogue and platform counts.
- `/exams` and `/exams/[code]` — searchable catalogue, filters, exam details, official paper size per part, marking model, syllabus coverage and official links.
- `/about`, `/how-it-works`, `/faq`, `/contact`, `/terms`, `/privacy`.
- Shared responsive navbar and footer, one top-right theme cycle button, GSAP reveal motion. Public pages render the public navbar for administrators too, including immediately after admin sign-out. Signed-out visitors no longer see a "My workspace" link, and the public footer no longer exposes the administrator sign-in link.
- Route-level loading skeletons lazy-load the daily, result, learning, topic and planner views. Long review items/chapters use `content-visibility: auto` so off-screen content is painted lazily, and study-note images use native `loading="lazy"`.
- Responsive layout: public pages, dashboard, daily schedule, exam player, result review, learning centre, topic reader, planner and auth pages are checked at 320, 375, 768 and 1024 px with no horizontal overflow. The mobile top bar hides the redundant page title, schedule rows stack their controls, the question pager compacts, and the palette becomes six columns on narrow screens.

### Accounts

- Registration is a guided conversation rather than a single long form: one question per screen (name, email, password, phone, date of birth, gender, state, district, education, language, optional picture, exams, per-exam level and paper, review), with Back and Skip, no running transcript, and nothing written until the final review screen, which lists every answer once.
- The state question is followed by a district question whose options come from the chosen state; the server rejects a district that does not belong to that state. The stored column is still `User.city`, relabelled District in the interface.
- Profile pictures are uploaded by drag-and-drop or file browse through the server-side upload proxy. The old URL field is gone; when storage is not configured the uploader says so honestly and the rest of registration still works.
- Candidate login is separate from the administrator entry point at `/login/admin`. A candidate login rejects administrator accounts and points to the admin page.
- Sign-in and administrator sign-in use the same stage as registration: the shared brand header (theme cycle, Home), the masked plan grid and aurora backdrop, and one compact card. The old split-screen auth layout is gone.
- Login, logout, session handling, consent records, a `FREE` subscription record and notifications.
- Administrators sign in at `/login/admin` and can reset their password after confirming the current password; a reset revokes all administrator sessions.
- Self-registration is limited to candidates aged 18+ in this build. Under-18 onboarding requires verified guardian consent, which is not enabled.
- No email OTP delivery is configured. Registration and sign-in work, but an email address is not independently verified.

### Candidate workspace (`/app`)

- Dashboard with today's paper, its mode (full official mock or practice set), the official pattern, streak, readiness, goals, recent results and the next verified event.
- Multi-paper exams: paper variants are selected at registration and in My Exams; the chosen variant drives the pattern shown and the paper built.
- Daily exams: prepare, start, resume, timed player, flagging, palette, server deadline, local answer persistence across refresh, submission and result review.
- Result page: objective score, accuracy, negative marks, section/subject/topic breakdown, correct and selected answers, explanations, and a “revise this topic” link into the learning centre.
- Result review resolves a syllabus topic even for seeded questions that were never linked to one. It picks the closest topic in the same subject by keyword scoring and labels it “Closest syllabus topic for this question” instead of pretending it is an exact mapping. When nothing matches it says so and shows a subject-level revision label.
- Learning centre: exam → subject → unit → chapter → topic, topic search, "continue studying" from the last visit (recorded by `recordTopicVisit` without overwriting a completed/needs-revision status), saved topics, note-availability counts, topic status and bookmarks.
- Topic reader: the exact official syllabus passage with its source link; curated notes and detailed AI-generated notes rendered with headings, lists, formulas, worked examples and callouts; official external resources (NCERT, ePathshala, DIKSHA, SWAYAM, NPTEL) with publisher, licence/usage note and an "external" label; previous/next topic navigation.
- Result question review paginates ten questions at a time with page controls, instead of rendering the whole 180-question paper in one DOM tree. The exam player fills the viewport and the question palette scrolls inside its own column, removing the large empty gap under the question card.
- Planner: daily goals, revision queue with a direct "Revise topic" link into the learning centre (the exam result is no longer used as the revision entry point), weakest topics and AI/fallback study plans.
- Analytics: readiness components, score trend, subject accuracy, weak topics, syllabus coverage and submitted-paper history.
- Calendar: target dates and verified events only, with source links and confirmed/tentative states.
- Achievements: 14 real milestones evaluated from recorded activity, earned states, progress meters and XP.
- Notifications: activity-generated inbox with per-item and mark-all-read actions.
- Profile and exam plan editing (multiple exams, one level, one paper variant per exam), including a State → District dropdown pair and drag-and-drop picture replacement.
- Removing an exam in My exams deactivates its target, clears it from the top-right exam switcher, and stops new papers for it. The target row (same exam and target year), submitted attempts, syllabus progress, notes and the saved start time are preserved; adding the same exam and target year again reactivates that row and resumes the preserved state. If the removed exam was the active one, the active-exam cookie is cleared so it does not silently become active again on re-add.

### Admin console (`/admin`, sign in at `/login/admin`)

- Dedicated administrator login and password reset, separate from candidate authentication. Administrators are excluded from candidate counts.
- Overview of live candidate counts, recent registrations, recent submissions and AI activity.
- Exam catalogue: create categories and exam shells, edit paper configuration, inspect subjects/questions/plan counts, and let AI draft official paper parts and sections. AI drafts are always saved as “needs verification”.
- Question bank: AI-generated drafts are the primary path; manual authoring remains as a fallback; approve or archive before questions enter a paper.
- Syllabus library: browse per exam, add unit/chapter/topic, import a validated JSON bundle, and inspect official-source import status.
- Exam calendar: add verified events, import a validated JSON bundle, see confirmed/tentative/past events.
- Candidates: inspect plans, attempts and location, suspend or reactivate accounts.
- AI operations: provider/model status, setup instructions, usage by operation and recent call log.

### Data and scoring

- Daily paper selection is deterministic for a user, exam, part and date; the paper is stored so it cannot change during the day.
- Official patterns are stored per exam in `ExamConfiguration.sections`; 15 of 16 exams were verified against official 2026 bulletins/prospectuses. NIFT remains provisional because its marks are programme-specific.
- Marks and accuracy are computed from `QuestionOption.isCorrect` / `numericalAnswer`, the paper snapshot's section marks and `QuestionExam.marks` / `negativeMarks` as a fallback.
- Incorrect answers create revision-queue entries with a due date.
- Performance records, goals and achievements are updated from submitted attempts.
- Results, analytics and admin counts come from the database; there are no static demo figures.
- The Prisma client uses a small `pg` pool (maximum 5, 15-second idle timeout, 5-minute connection lifetime) with TCP keepalive. Neon closes idle sockets; recycling them locally avoids `P1017: Server has closed the connection` during a page load.

## Current database state (testing database)

| Item | Count |
| --- | --- |
| Active exams | 16 |
| Exam categories | 10 |
| Active subjects | 13 |
| Syllabus topics | 1,456 |
| Active questions | 1,377 (1,274 AI-authored from official syllabus, 103 curated legacy) |
| AI-generated topic notes | 392 rows, reuse-checked (0 duplicate notes per topic) |
| Duplicate question stems | 0 across the whole bank |
| Achievements | 14 |
| Exam parts / patterns | 16 exams with at least one paper pattern |
| Official syllabus sources | 17 imported, 0 failed (all 16 exams, originals + locally extracted text in `syllabus/`) |
| Verified calendar events | 0 (intentional) |
| Candidate accounts | 0 — the roster was reset, ready for a fresh sign-up |
| Administrator accounts | 1 review administrator |

The original bootstrap administrator was removed. The remaining administrator is a review account created for testing; its password is not stored in this file.

Every candidate account created during testing was deleted with `npm run db:reset-candidates --apply`; the script refuses to run when a non-administrator authored or reviewed syllabus/content records, and it never touches administrators. Candidate-owned rows were cascaded or explicitly removed with the account.

The 16 exams are CAT, CLAT, CUET (UG), GATE Computer Science, IBPS PO, JEE Advanced, JEE Main, KEAM, NATA, NEET (UG), NIFT Entrance, SSC CGL, UCEED, UGC NET, UPSC CSE and UPSC NDA & NA.

Migrations `20261115000100_ai_exam_platform`, `20261115000200_exam_category_compat`, `20261115000300_exam_parts`, `20261115000400_syllabus_sources`, `20261116000100_daily_paper_count` and `20261116000200_daily_start_time` are applied. The legacy tables and legacy admin pages are preserved rather than destructively dropped; the new product layer uses the new platform models.

## Verification performed

- `npm run typecheck` passes.
- `npm run db:seed` is idempotent and completes against the Neon testing database.
- Public pages return 200: `/`, `/exams`, `/exams/[code]`, `/about`, `/how-it-works`, `/faq`, `/contact`, `/register`, `/login`, `/terms`, `/privacy`.
- Administrator login at `/login/admin` renders the dedicated sign-in and reset-password tabs; `/admin` redirects when signed out. Admin sign-out returns to the public homepage with the public navbar (`Sign in` / `Start preparing`, no admin link).
- End-to-end candidate browser test: registration → dashboard → prepare daily paper → start → answer → submit → result → analytics → planner → learning centre → topic status → calendar → achievements → notifications → profile → exam plan.
- Full-mock browser test on CAT: dashboard shows the 68-question / 120-minute / 204-mark official paper, preparation creates a 68-question full mock, the player renders all 68 palette entries, and submission produces a scored result.
- Follow-up paper checked directly after the fix: NEET slot 2 (previously 60 Q / 60 min / 240 marks) rebuilt as **180 Q / 180 min / 720 marks**, `FULL_MOCK`, exactly 4 marks per question and 1 negative mark per question. The short untouched paper was deleted and regenerated; submitted history was not rewritten.
- Study goal checked after the separation: the per-exam `dailyMinutes` target remains the stored value (e.g. 120 minutes for Extreme) and is not replaced by paper time; paper time is displayed separately as papers × official duration.
- Planner revision link checked in the browser: a revision item resolved to `/app/learn/<topicId>` with the label "Revise topic"; the old exam-result link and its `Review answer` label are gone.
- Start-time scheduling checked by unit test: a 10:00 IST start resolves to `04:30Z`, and a paper is not available before that time. The daily schedule card is now a single per-exam list (papers/day + start time), not a separate active-exam form plus a duplicate list.
- Public/auth surfaces checked in the browser after candidate sign-out: the public header showed only Sign in / Start preparing, with no "My workspace" and no administrator link; the administrator page no longer shows "Candidate? Use the candidate login", and the candidate login no longer claims administrators use the same form.
- Exam removal was verified end-to-end with a temporary candidate: with GATE CS active, Remove + Save dropped GATE_CS from the switcher options, cleared `toprank_active_exam`, and kept NEET as the fallback active exam. Re-adding GATE CS at the same target year restored the same target row (identical id) with its saved start time, target date, completed syllabus topic and submitted attempt intact. The temporary candidate was deleted afterwards.
- The restyled `/login` and `/login/admin` were captured at 1440 × 900 and 393 × 852 in both themes: shared header, masked grid backdrop, compact card, no horizontal overflow and no clipped form fields.
- Responsive checks used same-origin iframes at 320, 375, 768 and 1024 px for `/`, `/exams`, `/register`, `/login`, `/login/admin`, `/app`, `/app/daily`, `/app/learn`, `/app/learn/[topicId]`, the result review, `/app/planner`, `/app/exams`, `/app/analytics`, `/app/profile`, `/app/notifications`, `/app/calendar` and `/app/achievements`. No page exceeded its viewport; the 320 px admin login overflow was fixed with `min-width: 0` and input caps.
- Date rollover checked on 16 Nov: the candidate's 15 Nov CAT result stayed in history, the dashboard correctly showed that today's paper was not prepared, and preparing created a new “CAT full mock · 16 Nov” paper while `/app/daily` listed both days.
- Result review renders correct and selected answers, section pills, `paperMeta` mode/official count, and syllabus links; seeded unlinked questions resolve to a closest topic and are labelled as inferred.
- Result review pagination was verified with a 48-question submitted fixture: page 2 showed questions 11–20, ten review items, and Previous/1/2/3/4/5/Next controls pointing at the right pages. The fixture was removed after the check.
- The topic reader was verified in the browser: it rendered the official JEE Advanced syllabus passage, the "AI-generated" detailed note (Overview, Key points, Formulas, Worked example, Common mistakes), the official NCERT/ePathshala/DIKSHA/SWAYAM/NPTEL resource card with publisher and usage notes, and previous/next topic links.
- Learning-centre search was verified with `?q=thermo`: three matching JEE Advanced topics with subject and chapter context. The "Notes ready" counter reflected the stored notes.
- Player layout was checked at a 718px viewport: the question card and palette fill the player row, the palette scrolls inside its own column, and the Previous/Next actions sit at the bottom of the question card.
- Paper engine checked directly for every exam: 15 `FULL_MOCK` papers with exact section quotas, including NEET 180 Q / 720 marks / 180 min, JEE Main 75/300, KEAM 150/600, CLAT 120/120, GATE 65/100, SSC CGL 100/200 and CAT 68/204. UGC NET remains a `PRACTICE_SET`. Duplicate stems per paper: 0.
- Admin browser test: overview, exams, questions, syllabus (including source status), calendar, candidates and AI pages; exam configuration save; candidate suspend/reactivate.
- Gemini 3.5 Flash verified for structured exam patterns, question drafts and study notes, with `AIUsageLog` rows written. Later feedback calls hit the free-tier quota and fell back deterministically; the failure is logged.
- The JEE Main public page renders Paper 1, Paper 2A and Paper 2B with the correct totals; registration and My Exams expose the variants.
- The JEE Main official syllabus PDF was imported and excerpt matching was sampled: 30/30 tested topics returned official text and the correct source URL.
- `/admin/syllabus?exam=JEE_MAIN` renders the official-source card (3 imported / 2 failed) with each source URL, format, date and recorded error.
- Fonts are vendored under `src/app/fonts/`; the app renders and reloads without reaching Google Fonts, including the ₹ glyph through the latin-ext face.
- Filled action buttons were re-checked in light and dark themes after the cascade fix: `.body-platform a` was outranking `.tp-btn` on specificity, so anchor buttons inherited the body ink (black in light theme). The base link rule now uses `:where(a)`, and every filled, accent, ghost and soft button resolves its intended ink (`#ffffff` on filled and accent, theme ink on ghost, brand ink on soft).
- Syllabus and calendar importers were exercised directly, including duplicate-calendar skipping and cleanup.
- The guided registration was driven end-to-end in the browser: intro → name → email → password → skip phone → DOB → gender → Kerala → Ernakulam → education → language → skip picture → exam selection → plan → review → account created; the new candidate landed on `/app` and `/app/profile` showed "14 districts in Kerala".
- The district rule was checked against the Zod schema: Kerala + Ernakulam passes, Kerala + Mumbai fails with "Choose a district from the selected state.", and an unknown state is rejected.
- `/api/uploads/avatar` reports the active provider and its missing variables: it returned `{"configured":false,...,"missing":["CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"]}` with Cloudinary pinned and no credentials, and the uploader shows the matching notice instead of failing silently.
- The Cloudinary signature rule was checked against an independently computed SHA-1 of the sorted parameter string, so the signed server upload matches Cloudinary's documented scheme.
- `npm run db:reset-candidates` reported exactly the single test candidate, then deleted it; only the administrator remained and a second run reported "Nothing to remove."

## Known limitations and pending work

- **Full mocks now cover 15 of 16 exams, and every paper of the defence and JEE Advanced pathways.** NEET, JEE Main Paper 1, JEE Advanced Paper 1 + Paper 2, KEAM, CLAT, CUET, CAT, GATE CS, SSC CGL, IBPS PO, UPSC CSE, NDA Paper 1 + Paper 2, NIFT, NATA and UCEED build their complete objective paper with exact section quotas. UGC NET remains a practice set because Paper 2 is subject-specific and no subject is selected in the plan. JEE Main Paper 2A/2B remain practice sets because their Aptitude and Planning sections have no topic map yet; filling them with Mathematics would misrepresent the paper.
- **Subjective design sections are excluded from objective mocks.** NATA A1–A3, UCEED Part B and NIFT Creative Ability cannot be scored from a stored key. The paper engine now omits them and records "subjective — not auto-scored" in section coverage, so a drawing slot is never filled with an unrelated MCQ. NATA therefore runs 50 objective questions, UCEED 57 and NIFT 100.
- **AI-authored keys are mechanically checked, not guaranteed.** Every batch passes structural validation, a reasoning-leak filter, exact and near-duplicate checks, and `npm run questions:audit`, which compares the key with the last value proved by the explanation. That audit found one genuinely contradictory key in 1,274 questions (a polygon-angle item) and it was corrected. Remaining heuristic flags are intermediate values in correct explanations. A human spot-check is still required before treating an AI bank as publication-grade.
- **Notes coverage is improving but not complete.** 392 AI note rows cover 86 of 102 NEET topics, 59 of 105 JEE Main/JEE Advanced/KEAM topics, and 14 each in the common-subject exams after `notes:share`. Some chapters still lack a note because Gemini returned `503` repeatedly during the run. Re-run `npm run generate:notes -- --exam=...`, then `npm run notes:share -- --apply`; the script skips topics that already have a note.
- **Official notes are linked, not copied.** NCERT, ePathshala, DIKSHA, SWAYAM and NPTEL are copyrighted or have item-level licences, so the product opens them on the publisher's site and shows publisher/usage notes. Only original AI notes and the quoted official syllabus passages are stored.
- **AI notes are clearly labelled and need judgement.** They are grounded in the official syllabus and passed length/structure checks, but they are not a textbook and may contain errors. The page labels them "AI-generated" and tells the student to review critically.
- **Generation is resumable, not automatic.** Flash Lite served the authoring run, but transient `503` "high demand" responses interrupted several batches and quota limits how much can be authored in one day. Re-run `npm run generate:questions -- --exam=...` to fill any shortfall; the script never duplicates a stem.
- **GATE CS learning topics and generated questions use different sources.** GATE questions are authored directly from the official GATE CS syllabus PDF (`--official` mode) and link to that document, but the curated learning-centre topic list for GATE still uses the shared Computer Awareness topics. The result review therefore relies on the closest-topic resolver for GATE, labelled as inferred, until the GATE topic catalogue is rewritten from the official sections.
- **CAT and IBPS PO have no official topic list.** Their questions are authored from the curated topic map and labelled `CURATED_TOPICS`; the product does not claim an official topic-wise syllabus for them.
- **Syllabus import coverage is complete but uneven in depth.** All 16 exams have at least one official document, 17 sources imported and 0 failed. Some documents are full syllabi (NEET, JEE, GATE), while CAT and IBPS PO contain pattern/marking only, and UGC NET describes Paper 2 without subject syllabi.
- **PYQ import needs human-transcribed JSON.** There is no safe automatic PDF question extractor. The importer validates and stages structured files; it does not invent questions.
- **Some result-page topic links are inferred.** Seeded questions are not all linked to a syllabus topic, and GATE official-mode questions have no curated topic ID. The closest-topic resolver labels inferred matches honestly and falls back to a subject-level label rather than inventing a mapping.
- **Email verification and OTP delivery are not active.** Accounts work, but email ownership is not proven. Do not treat the email field as verified.
- **Self-registration is 18+ only.** Guardian-consent onboarding exists in the legacy schema but is not enabled for this product flow.
- **File uploads need Cloudinary credentials.** The upload route, signature, validation, dropzone and profile wiring are complete, but `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are not set, so uploads answer `503` and the dropzone explains why. Nothing else depends on storage. The R2 values in the local `.env` are placeholders and R2 additionally needs a billing method on the Cloudflare account; switch with `STORAGE_PROVIDER=r2` once both are real. The per-IP upload throttle is per process, not a shared limiter.
- **Uploaded images are not moderated.** Only JPEG/PNG/WebP bytes under 2 MB are accepted and the type is sniffed from the file itself, but there is no human or automated content review.
- **No paid plans or checkout.** Every new account receives a `FREE` subscription record; payment integration is not implemented.
- **Calendar coverage is empty by design.** Real dates must be added by an administrator or imported from a verified source. No date is guessed.
- **Syllabus and question coverage are curated, not exhaustive.** 1,377 questions and 1,456 topics exercise the loop; they do not claim complete exam readiness. More AI-authored items improve variety across days, and the 1,456-topic catalogue still needs exam-specific rewrites in places (notably GATE CS, JEE Main Paper 2 aptitude/planning, and UGC NET Paper 2).
- **Admin editing is intentionally narrow.** Admins can add categories/exam shells, edit exam configuration, generate patterns with AI, add syllabus topics, import bundles, inspect official sources, add/import calendar events, approve/archive questions and suspend candidates. Deleting or renaming categories, editing individual syllabus topics, editing calendar events and deleting candidates are not exposed.
- **Legacy routes and screens remain.** Some older `/workspace`, `/practice/*`, `/learn/*`, `/progress-method` and `/admin/*` pages still exist for compatibility but are not linked from the new navigation. They may use the old design.
- **Remote Neon latency is high in local development.** Page loads and submit actions can take seconds because each query is a network round trip. This is an environment characteristic, not a scoring shortcut; a local PostgreSQL instance would be faster for development.
- **Deployment is prepared but not executed here.** `DEPLOYMENT.md` documents the Vercel + Neon setup, environment variables and branch-based preview/production flow. The build command already regenerates the Prisma client, and the Neon database has all 30 migrations. No Vercel project, token or domain has been created from this workspace.
- **The Tailwind migration is staged.** The public header, footer and shell plus the new registration, profile and upload components use Tailwind utilities; most existing screens still rely on the `tp-*` stylesheet. Both systems share the same design tokens, so the look is unchanged, but a full migration is still pending.
- **A design pass is still pending.** The light theme is heavier and the public pages are more card-heavy than intended; functionality was prioritised first.

## Branch and change discipline

- Work stays on `feature/ai-exam-platform`; `main` was not modified or merged.
- Schema changes are forward-only migrations. Existing rows and legacy tables were preserved wherever possible.
- The legacy optional catch-all route `src/app/[[...path]]` was removed because it conflicted with the new explicit `/` route; it remains recoverable from git history.
- Do not put passwords, API keys or database URLs in this file.
