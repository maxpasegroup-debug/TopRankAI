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
- **Validation:** Zod schemas shared by UI payloads, server actions and importers.
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
- **One paper per day.** `DailyExam` is unique on `(userId, examId, scheduledDate, slot)`, so the day's paper is fixed once prepared. A 10-day recency window rotates questions and avoids repeating the same items too often.
- **Full mock vs practice set is decided honestly.** If the reviewed pool covers the part's official total, the paper is a `FULL_MOCK` with the official question count, official duration and per-section marks. Otherwise it is a `PRACTICE_SET` sized at roughly half the official paper (never below the admin-configured practice floor, never beyond the pool), and the UI states exactly how many of the official questions it covers.
- **Coverage is stored, not implied.** Each paper's snapshot records mode, official total, official marks, duration, section quotas and selected counts, plus the per-question section and marks used for scoring.
- **Deterministic scoring.** Marks, negative marking, accuracy, score percentage and subject/topic breakdowns come from the stored answer key and the paper snapshot. AI never computes an objective score.

Examples from the current bank (all verified in the browser and by direct engine calls):

| Exam | Official paper | Current daily paper |
| --- | --- | --- |
| CAT | 68 Q / 120 min / 204 marks | Full mock, 68 Q / 120 min |
| JEE Main Paper 1 | 75 Q / 180 min / 300 marks | Practice set, 25 Q / 60 min / 100 marks |
| NEET (UG) | 180 Q / 180 min / 720 marks | Practice set, 25 Q / 25 min |
| CLAT | 120 Q / 120 min | Practice set, 60 Q / 60 min |

The exam catalogue, exam detail page, registration wizard, plan editor, planner, dashboard and daily pages all advertise the official paper size rather than the old 8-question daily count. “Practice set floor” is labelled as an administrator-configured minimum, not the advertised paper.

## AI setup and boundaries

AI is optional. Without a key the application still works end to end and labels every deterministic fallback.

1. Create a free Google AI Studio key: <https://aistudio.google.com/app/apikey>.
2. Add `GEMINI_API_KEY=...` to `.env` and restart `npm run dev`.
3. Override the model with `GEMINI_MODEL` if needed (default `gemini-3.5-flash`).
4. Set `AI_FEATURES_ENABLED=false` to disable all AI calls without deleting the key.

AI is used for:

- Narrative feedback after a submitted paper.
- Structured study notes for a syllabus topic, anchored to official syllabus excerpts when available.
- A suggested study plan from recorded weak topics.
- Draft practice questions written from a syllabus topic, anchored to official syllabus excerpts when available.
- Draft official paper patterns/sections for an exam, always saved as “needs verification”.

AI is **not** used for marks, accuracy, negative marking, score percentages, streaks, readiness totals or achievements. Those are deterministic server calculations from the stored answer key and recorded activity. AI drafts are created as `NEEDS_REVIEW` and never enter a live paper until an administrator approves them. Every AI call is recorded in `AIUsageLog`.

### Feedback reliability

- Every AI task now sends a JSON `responseSchema`, so the model returns the expected shape instead of prose that has to be guessed at.
- Each call has a per-task timeout, bounded retry count and output-token cap. Feedback, for example, uses a single attempt, a 15-second timeout and 1,200 output tokens; Gemini is configured with a low thinking level to keep latency down.
- Feedback is normalised tolerantly (aliases, string-to-array coercions, repaired focus areas) before validation.
- Submission never fails because of AI. If the provider errors, times out or quota-limits, the result is committed, deterministic feedback is generated from the recorded numbers, and the page says AI commentary is unavailable rather than implying a key is missing.
- Deterministic feedback is regenerated on view when the stored source is not AI, so weakest topics/subjects always match the current resolved review.

**Current provider state:** the Gemini key works, but the free tier returned `429` quota errors during the final verification run. That blocks live AI feedback and further PDF transcription until the quota resets or billing is enabled. The deterministic path handled it correctly and the failure is logged.

## Official syllabus and previous-year question intake

There is **no single free, official, machine-readable API** for the syllabus and calendar of every Indian competitive exam. Sources are fragmented across commission and university websites, PDF notifications and state portals. The product therefore never invents content.

### Syllabus sources (`SyllabusSource`)

- `scripts/import-syllabus.ts` crawls an official URL, discovers syllabus links, converts HTML to text, and transcribes PDFs through Gemini. It rejects navigation shells and duplicate excerpts, sanitises invalid UTF-8, and upserts each document with its source URL, format and `IMPORTED` / `FAILED` status (plus the error when a fetch fails).
- Imported text is resolved per topic by `getOfficialSyllabusExcerpt`, which scores keyword and title matches, cuts a window around the best match aligned to the nearest section heading, and returns up to three excerpts with their source URLs. It returns `null` when nothing matches; it never fabricates an excerpt.
- The excerpt is injected into AI question drafting and study-note prompts, so generated material stays anchored to a real official document.
- `/admin/syllabus` now shows import status per exam: imported/failed counts, format, source URL, fetch date and the recorded error for each recent source.
- Imported so far: the JEE Main 2027 syllabus PDF (38,956 characters), the JEE Main syllabus page and the NEET official page. These are marked `IMPORTED`.
- Twelve further attempts (UPSC and several PDF bulletins) are recorded as `FAILED` with their reasons: navigation-only pages, Gemini `429` quota, or a `RECITATION` block. They are visible in the admin console with the error, not silently dropped.

### Previous-year questions

- `scripts/import-pyq.ts` imports a structured JSON file (`prisma/pyq/template.json`, documented in `prisma/pyq/README.md`) into `PREVIOUS_YEAR` questions, links them to the exam, computes a checksum for duplicate detection and writes them as `DRAFT` / `NEEDS_REVIEW`. It is a dry run unless `--apply` is passed.
- Questions imported this way require human approval before entering a paper, exactly like AI drafts.
- Automatic extraction of questions from PDFs is intentionally not implemented: it is unreliable and copyright-sensitive. A human supplies the structured file.

## What is built

### Public site

- `/` — product landing page with real catalogue and platform counts.
- `/exams` and `/exams/[code]` — searchable catalogue, filters, exam details, official paper size per part, marking model, syllabus coverage and official links.
- `/about`, `/how-it-works`, `/faq`, `/contact`, `/terms`, `/privacy`.
- Shared responsive navbar and footer, one top-right theme cycle button, GSAP reveal motion. Public pages render the public navbar for administrators too, including immediately after admin sign-out.

### Accounts

- Four-step registration: account, profile (DOB-derived eligibility, gender, state, city, education, language, phone, optional picture URL), exam selection with per-exam level, paper variant and target year, review and consent.
- Candidate login is separate from the administrator entry point at `/login/admin`. A candidate login rejects administrator accounts and points to the admin page.
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
- Learning centre: exam → subject → unit → chapter → topic, topic status, bookmarks, curated notes, formulas, examples and AI notes.
- Planner: daily goals, revision queue (complete/dismiss), weakest topics and AI/fallback study plans.
- Analytics: readiness components, score trend, subject accuracy, weak topics, syllabus coverage and submitted-paper history.
- Calendar: target dates and verified events only, with source links and confirmed/tentative states.
- Achievements: 14 real milestones evaluated from recorded activity, earned states, progress meters and XP.
- Notifications: activity-generated inbox with per-item and mark-all-read actions.
- Profile and exam plan editing (multiple exams, one level, one paper variant per exam).

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
| Active questions | 109 |
| Achievements | 14 |
| Exam parts / patterns | 16 exams with at least one paper pattern |
| Official syllabus sources | 4 imported (1 real syllabus PDF, 3 official-site pages), 12 failed (recorded with reasons) |
| Verified calendar events | 0 (intentional) |
| Candidate accounts | 2 testing accounts |
| Administrator accounts | 1 review administrator |

The original bootstrap administrator was removed. The remaining administrator is a review account created for testing; its password is not stored in this file.

The 16 exams are CAT, CLAT, CUET (UG), GATE Computer Science, IBPS PO, JEE Advanced, JEE Main, KEAM, NATA, NEET (UG), NIFT Entrance, SSC CGL, UCEED, UGC NET, UPSC CSE and UPSC NDA & NA.

Migrations `20261115000100_ai_exam_platform`, `20261115000200_exam_category_compat`, `20261115000300_exam_parts` and `20261115000400_syllabus_sources` are applied. The legacy tables and legacy admin pages are preserved rather than destructively dropped; the new product layer uses the new platform models.

## Verification performed

- `npm run typecheck` passes.
- `npm run db:seed` is idempotent and completes against the Neon testing database.
- Public pages return 200: `/`, `/exams`, `/exams/[code]`, `/about`, `/how-it-works`, `/faq`, `/contact`, `/register`, `/login`, `/terms`, `/privacy`.
- Administrator login at `/login/admin` renders the dedicated sign-in and reset-password tabs; `/admin` redirects when signed out. Admin sign-out returns to the public homepage with the public navbar (`Sign in` / `Start preparing`, no admin link).
- End-to-end candidate browser test: registration → dashboard → prepare daily paper → start → answer → submit → result → analytics → planner → learning centre → topic status → calendar → achievements → notifications → profile → exam plan.
- Full-mock browser test on CAT: dashboard shows the 68-question / 120-minute / 204-mark official paper, preparation creates a 68-question full mock, the player renders all 68 palette entries, and submission produces a scored result.
- Date rollover checked on 16 Nov: the candidate's 15 Nov CAT result stayed in history, the dashboard correctly showed that today's paper was not prepared, and preparing created a new “CAT full mock · 16 Nov” paper while `/app/daily` listed both days.
- Result review renders correct and selected answers, section pills, `paperMeta` mode/official count, and syllabus links; seeded unlinked questions resolve to a closest topic and are labelled as inferred.
- Paper engine checked directly: CAT `FULL_MOCK` 68 Q / 120 min / 204 marks; CLAT `PRACTICE_SET` 60 Q / 60 min; JEE Main `PRACTICE_SET` 25 Q / 60 min / 100 marks (8/7/8 sections); NEET `PRACTICE_SET` 25 Q / 25 min.
- Admin browser test: overview, exams, questions, syllabus (including source status), calendar, candidates and AI pages; exam configuration save; candidate suspend/reactivate.
- Gemini 3.5 Flash verified for structured exam patterns, question drafts and study notes, with `AIUsageLog` rows written. Later feedback calls hit the free-tier quota and fell back deterministically; the failure is logged.
- The JEE Main public page renders Paper 1, Paper 2A and Paper 2B with the correct totals; registration and My Exams expose the variants.
- The JEE Main official syllabus PDF was imported and excerpt matching was sampled: 30/30 tested topics returned official text and the correct source URL.
- `/admin/syllabus?exam=JEE_MAIN` renders the official-source card (3 imported / 2 failed) with each source URL, format, date and recorded error.
- Fonts are vendored under `src/app/fonts/`; the app renders and reloads without reaching Google Fonts, including the ₹ glyph through the latin-ext face.
- Filled action buttons were re-checked in light and dark themes after the cascade fix: `.body-platform a` was outranking `.tp-btn` on specificity, so anchor buttons inherited the body ink (black in light theme). The base link rule now uses `:where(a)`, and every filled, accent, ghost and soft button resolves its intended ink (`#ffffff` on filled and accent, theme ink on ghost, brand ink on soft).
- Syllabus and calendar importers were exercised directly, including duplicate-calendar skipping and cleanup.

## Known limitations and pending work

- **Full mocks are limited by the reviewed bank.** The engine builds a full official paper only when the reviewed pool covers it. CAT qualifies (68 questions), but its section mix is skewed (4 VARC / 3 DILR / 57 QA) because the bank is not yet section-balanced, and because 68 is also the paper size, every CAT full mock necessarily reuses the whole bank until more questions are added. JEE Main holds 25 of 75, NEET 25 of 180, CLAT 70 of 120 and GATE 64 of 65. More reviewed questions per exam and section are the real unblock.
- **AI feedback is quota-limited right now.** The free Gemini tier returned `429` during final verification. Feedback falls back deterministically; study notes, plans and question drafts also need quota. A paid tier or a different key restores live AI.
- **Syllabus import coverage is partial.** Only the JEE Main syllabus PDF contains real syllabus text (about 39,000 characters). The other “imported” records are the official NEET and JEE Main website pages, which are navigation/homepage text, not syllabus content, and no official NEET syllabus body has been captured yet. UPSC and similar sites serve JavaScript/navigation shells that plain fetch cannot read, and several PDFs need quota. The curated 1,456 syllabus topics are therefore still the working syllabus until more official documents are imported and approved; admin editing and the structured importer cover the gap.
- **PYQ import needs human-transcribed JSON.** There is no safe automatic PDF question extractor. The importer validates and stages structured files; it does not invent questions.
- **Some result-page topic links are inferred.** Seeded questions are not all linked to a syllabus topic. The closest-topic resolver labels inferred matches honestly and falls back to a subject-level label rather than inventing a mapping.
- **Email verification and OTP delivery are not active.** Accounts work, but email ownership is not proven. Do not treat the email field as verified.
- **Self-registration is 18+ only.** Guardian-consent onboarding exists in the legacy schema but is not enabled for this product flow.
- **Profile pictures are URLs, not uploads.** There is no file storage or image moderation.
- **No paid plans or checkout.** Every new account receives a `FREE` subscription record; payment integration is not implemented.
- **Calendar coverage is empty by design.** Real dates must be added by an administrator or imported from a verified source. No date is guessed.
- **Syllabus and question coverage are curated, not exhaustive.** 109 questions and 1,456 topics exercise the loop; they do not claim complete exam readiness.
- **Admin editing is intentionally narrow.** Admins can add categories/exam shells, edit exam configuration, generate patterns with AI, add syllabus topics, import bundles, inspect official sources, add/import calendar events, approve/archive questions and suspend candidates. Deleting or renaming categories, editing individual syllabus topics, editing calendar events and deleting candidates are not exposed.
- **Legacy routes and screens remain.** Some older `/workspace`, `/practice/*`, `/learn/*`, `/progress-method` and `/admin/*` pages still exist for compatibility but are not linked from the new navigation. They may use the old design.
- **Remote Neon latency is high in local development.** Page loads and submit actions can take seconds because each query is a network round trip. This is an environment characteristic, not a scoring shortcut; a local PostgreSQL instance would be faster for development.
- **No deployment has been configured.** Everything above was verified on localhost.
- **A design pass is still pending.** The light theme is heavier and the public pages are more card-heavy than intended; functionality was prioritised first.

## Branch and change discipline

- Work stays on `feature/ai-exam-platform`; `main` was not modified or merged.
- Schema changes are forward-only migrations. Existing rows and legacy tables were preserved wherever possible.
- The legacy optional catch-all route `src/app/[[...path]]` was removed because it conflicted with the new explicit `/` route; it remains recoverable from git history.
- Do not put passwords, API keys or database URLs in this file.
