# Phase 5: Practice and Mistake-to-Mastery

## Outcome

Core code increment implemented; production exit NOT VERIFIED. There is still no
supplied, independently reviewed and appropriately licensed launch question corpus.
No sample content was created, imported, reviewed or published during execution.
The actions described below are implemented workflows, not executed content jobs.

## Implemented

- Studio Question Bank now creates immutable canonical question drafts, associates
  scored exams, protects answers and captures source/rights/licence/attribution.
  Single-choice, multiple-choice EXACT_SET and DECIMAL_EXACT numerical scoring reuse
  the existing engine. No unofficial exam scoring policy is inferred.
- Optional supersedesId creates a new question ID in the same chapter, retaining
  old questions and their attempts. Identical wording is allowed for an explicit
  successor; exact duplicate wording in that chapter is otherwise rejected.
  Historical answers, explanations and scores are not rewritten. Archival is an
  explicit separate action; publishing a successor does not automatically retire
  its predecessor or transfer bookmarks/progress.
- Administrator-only inspection includes protected keys and scoring settings;
  ordinary directories and active student questions remain answer-free.
- Independent administrator review records actor, timestamp, revision fingerprint
  and evidence covering question/explanation/scoring and source/licence. An author
  cannot review their own content or rights. This is editorial review, not automatic
  verification of a reviewer's educator qualifications or legal rights.
- Publication checks current review/source fingerprints, scoring and published
  exam/subject/chapter associations in a serializable transaction. Legacy publication
  routes cannot bypass independent review using a browser-supplied REVIEWED flag;
  existing exam-link scoring cannot be changed through that route.
- All question changes in this UI use new drafts/IDs, not in-place mutation of used
  questions. Source changes likewise require a newly reviewed successor.
- Practice revision now sits beside existing mock revision at /practice/revision.
  Latest incorrect attempts, bookmarks, preserved submitted explanations and available
  lesson/retry links provide next actions. Correct retries leave the mistake queue
  unless bookmarked. Mark reviewed does not grant mastery or change a score.
  A subsequent incorrect attempt reopens review; stale review requests conflict.
- Bookmark state is absolute and owner-bound; exact question-state reads are not
  affected by queue truncation. Unattempted bookmarks disclose no explanation.
- Existing owner/UUID-bound serializable scoring and bounded P2002/P2034 retries
  remain authoritative. Results retain the original question text/explanation/score.
- Attempt history adds owner-validated stable keyset pages of 50; the legacy default
  GET response remains compatible. The history screen can load earlier attempts.
- Uncertain client submissions freeze their UUID and answer. Owner/question-scoped
  sessionStorage retains the student's own pending payload across a reload in that
  tab; recovery is accepted only within 24 hours. Confirmation replays the identical request. Confirmed
  responses and definitive validation failures remove it. No server answer keys or
  tokens are stored. Client data remains untrusted and is validated on the server.

## Routes And Files

- /admin/content -> Question Bank; /api/admin/content/questions GET directory,
  GET ?id=... private inspection, POST CREATE/REVIEW/PUBLISH/ARCHIVE.
- /practice/questions/[id] -> bookmark and recoverable submission;
  /api/student/practice/attempts POST retains existing scoring contract;
  GET ?page=1&cursor=... adds history pagination.
- /api/student/practice/revision GET queue or ?questionId=... exact bookmark;
  POST BOOKMARK or REVIEW. User/role/review timestamp claims are rejected.
- Shared admin/student handlers enforce authentication, role, mutation origin,
  bounded JSON, sanitized errors and no-store responses. Admin question bodies
  are limited to 64 KiB; student mutations retain the existing 4 KiB limit.
- Question implementation: src/server/question/authoring.ts, service.ts;
  src/server/operations/service.ts closes older publication bypasses.
- Practice implementation: src/server/practice/{service,revision}.ts;
  src/shared/practice-recovery.ts and src/components/practice/*.
- Studio integration: src/components/learning/{QuestionBank,StudioWorkspace}.tsx.
  Catch-all question routing passes the authenticated owner ID into recovery.
- next.config.ts supports an isolated phase5 build; Next generated typing imports
  and tsconfig includes were updated by preview/build tooling. Review those generated
  differences before staging. Existing preview processes were not stopped.

## Schema

New forward-only migration: 20261011000200_practice_revision, NOT APPLIED.
PracticeRevisionState uses canonical user/question foreign keys, a composite primary
key and owner/bookmark index. Question supersedesId is a restrictive self-reference
with an index. No historical migrations were edited or existing data rewritten.
Prisma client generation and schema validation are offline, not proof of SQL execution.

## Verification

Commands actually executed:

```powershell
npm.cmd run prisma:generate
npx.cmd prisma validate --config prisma7.config.ts
npm.cmd run typecheck
npx.cmd vitest run tests/question tests/content tests/student tests/mock tests/auth
npm.cmd test
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase5'}});process.exit(r.status??1)"
git -c core.safecrlf=false diff --check
```

Results: generation/validation PASS (Prisma 7.10.0), typecheck PASS,
focused 770 passed/1 skipped, full 1,276 passed/2 skipped, isolated build PASS
(Next 16.3.5; 62 static-generation entries), whitespace PASS.
The 67 added tests cover authoring authorization, draft/scoring shapes, independent
review, current source fingerprints, legacy bypasses, successors, parent availability,
owned revision/bookmarks, stale/idempotent review, recovery bounds/injection, protected
HTTP boundaries, error sanitization, history cursors, bounded submission retries,
escaped initial UI rendering and unapplied migration contracts.

Two new assertions initially failed: one incorrectly required an omitted Prisma
default field, and one matched ON UPDATE foreign-key clauses as data-update statements.
Both assertions were corrected; final focused/full runs passed. No failing test
was removed and no application protection was weakened to obtain passing results.

Persistence, concurrency and retry outcomes are MOCKED. Gated Upstash and PostgreSQL
tests were skipped, not passed. No live database or provider was accessed. Initial
React rendering tests are not browser acceptance or reload/network simulation.

Anonymous HTTP smoke checks against http://127.0.0.1:3011:

| Request | Result |
| --- | --- |
| GET /practice/revision | 307 |
| GET /admin/content | 307 |
| GET /api/student/practice/revision | 401 |
| GET /api/student/practice/attempts?page=1 | 401 |
| GET /api/admin/content/questions?id=example | 401 |
| POST /api/student/practice/revision (anonymous) | 401 |
| POST /api/admin/content/questions (anonymous) | 401 |

Preview PID 126552 is loopback-only and intentionally left running. No credentials,
student session or production authentication request was used for these checks.

## Limitations And Release Gates

- Apply/verify all pending migrations only on an explicitly approved isolated target,
  then test real PostgreSQL uniqueness, serializable races, owner isolation and history
  integrity. No disposable target was established by this increment.
- Authenticated desktop/mobile acceptance, actual interrupted-network/reload behavior
  and reviewed-content publication still require controlled acceptance testing.
- Admin authoring is a functional first increment using canonical IDs and JSON
  options/exam fields. Visual option/scoring editors, selector ergonomics, batch
  question imports, delegated reviewer permissions and formal change-request queues
  are not implemented here. Existing draft corrections use linked successors too.
- Duplicate detection is exact wording, not semantic/fuzzy duplicate detection.
- Revision shows latest attempts for up to 100 distinct questions and up to 200 review
  state rows, with a truncation notice. It is not an exhaustive, paginated revision
  archive; history itself is paginated. Correct retries are evidence, not mastery.
- Existing legacy PUBLISHED/REVIEWED questions were NOT inspected, backfilled or
  certified. Student eligibility still recognizes their existing REVIEWED flag;
  the stricter gate protects future publication, not retroactive provenance.
  Launch needs a real audit/retirement or reviewed-successor plan for those records.
- Student question browsing can span published exams; scoring/bookmark creation
  enforce the selected exam. A cross-exam question can therefore fail submission.
- Storage-disabled browsers retain in-memory retries only; closing the tab, expiration
  or clearing storage loses pending recovery. History can show accepted attempts.
  Owner-scoped sessionStorage is not encryption and assumes a trusted browser origin.
  Expired data is removed on a later visit to that question, not by a background purge;
  otherwise it remains until the browser clears/closes the tab's storage.
- Historic practice results preserve text/explanation/score but are not full immutable
  question/option/answer-key snapshots. Managed questions are immutable; external
  privileged database edits or seed tooling remain outside that guarantee.
- No content library, educator credential, licence or official syllabus was invented.
  No live AI/SIA indexing was activated or claimed.
- Local .env/process activation checks returned disabled booleans only. Production
  auth activation, policy/guardian and recovery-delivery gates remain disabled;
  configuredCommerceProvider remains null. Deployed environments were not inspected.
  Railway trusted-ingress and earlier live-service verification prerequisites remain.

No commit, push, deployment, staging, dependency install, migration/seed, database
connection, import execution or production activation occurred. Existing index and
unrelated work were preserved. Git reports an inaccessible global ignore file;
its configuration was not changed.

## Git And Proposed Commands

Branch: main. Final inventory: 168 dirty paths (62 tracked, 106 untracked), including
the new report; 15 pre-existing staged paths unchanged. Full inventory follows.
Phase 5 depends on earlier uncommitted foundation/content/command-centre work.
Do not publish an isolated Phase 5 commit without those prerequisites.

These commands are PROPOSED ONLY. Review the already staged earlier work before
committing: a normal commit also includes that existing index. Do not use git add .
without reviewing all unrelated work and environment exclusions.

```powershell
$phase5Files = @(
  'src/server/question/authoring.ts', 'src/server/question/service.ts',
  'src/server/practice/service.ts', 'src/server/practice/revision.ts',
  'src/server/operations/service.ts', 'src/shared/practice-recovery.ts',
  'src/components/journey/client.ts', 'src/components/practice/AnswerSubmission.tsx',
  'src/components/practice/AttemptHistory.tsx', 'src/components/practice/PracticeRevision.tsx',
  'src/components/practice/QuestionBookmark.tsx', 'src/components/learning/QuestionBank.tsx',
  'src/components/learning/StudioWorkspace.tsx', 'src/screens/practice/QuestionExperience.tsx',
  'src/app/[[...path]]/page.tsx', 'src/app/practice/revision/page.tsx',
  'src/app/api/admin/content/questions/route.ts',
  'src/app/api/student/practice/attempts/route.ts', 'src/app/api/student/practice/revision/route.ts',
  'prisma/schema.prisma', 'prisma/migrations/20261011000200_practice_revision/migration.sql',
  'tests/question/attempts.test.ts', 'tests/question/authoring.test.ts',
  'tests/question/revision.test.ts', 'tests/question/recovery.test.ts',
  'tests/question/phase5-routes.test.ts', 'tests/question/phase5-ui.test.tsx',
  'tests/question/revision-migration.test.ts', 'next.config.ts', 'tsconfig.json',
  'MASTER_BUILD_STATUS.md', 'CONTROLLED_VERIFICATION_REPORT.md', 'PRACTICE_MISTAKE_TO_MASTERY.md'
)
git status --short
git diff --cached --name-status
git --literal-pathspecs add -- $phase5Files
git diff --cached
git diff --cached --check
# Only after reviewing the complete index and including required earlier increments:
git commit -m "Build practice question review and Mistake-to-Mastery workflows"
git push origin main
```

Single next build task: Phase 6 timed-mock workflow gap review and completion,
reusing the existing mock engine; do not activate production or live infrastructure.

### Full Git Inventory

```text
 M .gitignore
AM CONTROLLED_VERIFICATION_REPORT.md
MM MASTER_BUILD_STATUS.md
M  PORTALS_CONSENT_TENANTS.md
 M next-env.d.ts
 M next.config.ts
A  prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
A  prisma/migrations/migration_lock.toml
 M prisma/schema.prisma
MM src/app/[[...path]]/page.tsx
 M src/app/api/auth/signup/route.ts
 M src/app/api/student/content/chapters/[chapterSlug]/lessons/route.ts
 M src/app/api/student/content/lessons/[lessonSlug]/route.ts
 M src/app/api/student/missions/preview/route.ts
 M src/app/api/student/practice/attempts/route.ts
 M src/app/practice/revision/page.tsx
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/MissionBoard.tsx
 M src/components/journey/OperationsWorkspace.tsx
 M src/components/journey/client.ts
MM src/components/portal/PortalWorkspace.tsx
 M src/components/practice/AnswerSubmission.tsx
 M src/components/practice/AttemptHistory.tsx
MM src/screens/AuthPages.tsx
 M src/screens/Learn.tsx
 M src/screens/Settings.tsx
 M src/screens/learning/LessonExperience.tsx
 M src/screens/learning/SubjectWorkspace.tsx
 M src/screens/practice/QuestionExperience.tsx
 M src/server/api/admin-handler.ts
 M src/server/auth/request-security.ts
 M src/server/auth/session.ts
 M src/server/auth/validation.ts
 M src/server/content/service.ts
 M src/server/journey/planner.ts
 M src/server/journey/service.ts
 M src/server/journey/validation.ts
 M src/server/mock/service.ts
 M src/server/operations/service.ts
M  src/server/portal/authorization.ts
M  src/server/portal/service.ts
 M src/server/practice/service.ts
 M src/server/question/service.ts
 M src/server/student/service.ts
 M src/server/student/validation.ts
 M tests/auth/hardening-routes.test.ts
 M tests/auth/signup-route.test.ts
 M tests/auth/signup-ui.test.ts
 M tests/auth/validation.test.ts
 M tests/content/service.test.ts
 M tests/mock/service.test.ts
M  tests/portal/authorization.test.ts
M  tests/portal/lifecycle.test.ts
A  tests/portal/migration-contract.test.ts
A  tests/portal/workspace.test.ts
 M tests/question/attempts.test.ts
 M tests/student/journey.test.ts
 M tests/student/operations.test.ts
 M tests/student/service.test.ts
 M tsconfig.json
 M vitest.config.ts
?? AGENTS.md
?? CLAUDE.md
?? CONTENT_KNOWLEDGE_STUDIO.md
?? DAILY_STUDY_COMMAND_CENTRE.md
?? EXAM_CATALOGUE_LEARNING.md
?? LAUNCH_FOUNDATION.md
?? PRACTICE_MISTAKE_TO_MASTERY.md
?? STUDENT_ACCOUNTS_ONBOARDING.md
?? config/environments/development.env.example
?? config/environments/production.env.example
?? config/environments/staging.env.example
?? config/environments/verification.env.example
?? content/launch/jee-neet-foundation-drafts.json
?? postgres-preflight.ts
?? prisma/migrations/20261010000600_accounts_consent_recovery/migration.sql
?? prisma/migrations/20261010000700_learning_editorial/migration.sql
?? prisma/migrations/20261010000800_content_knowledge_studio/migration.sql
?? prisma/migrations/20261011000100_daily_study_command_centre/migration.sql
?? prisma/migrations/20261011000200_practice_revision/migration.sql
?? src/app/account/consent/page.tsx
?? src/app/account/guardian-consent/page.tsx
?? src/app/admin/accounts/page.tsx
?? src/app/admin/content/page.tsx
?? src/app/api/account/consent/route.ts
?? src/app/api/account/guardian-consent/route.ts
?? src/app/api/admin/accounts/route.ts
?? src/app/api/admin/content/coverage/route.ts
?? src/app/api/admin/content/import/preview/route.ts
?? src/app/api/admin/content/import/route.ts
?? src/app/api/admin/content/questions/route.ts
?? src/app/api/admin/content/review/route.ts
?? src/app/api/admin/content/route.ts
?? src/app/api/admin/content/studio/route.ts
?? src/app/api/auth/guardian-consent/check/route.ts
?? src/app/api/auth/recovery/route.ts
?? src/app/api/auth/reset-password/route.ts
?? src/app/api/student/command-centre/choices/route.ts
?? src/app/api/student/command-centre/route.ts
?? src/app/api/student/practice/revision/route.ts
?? src/app/api/student/saved-resources/route.ts
?? src/app/guardian-registration/page.tsx
?? src/app/learn/catalogue/[examCode]/page.tsx
?? src/app/learn/catalogue/page.tsx
?? src/app/learn/saved/page.tsx
?? src/app/privacy/page.tsx
?? src/app/recover-account/page.tsx
?? src/app/reset-password/page.tsx
?? src/app/terms/page.tsx
?? src/components/account/AccountConsent.tsx
?? src/components/account/AdminAccounts.tsx
?? src/components/account/GuardianConsent.tsx
?? src/components/account/RecoveryForm.tsx
?? src/components/journey/MissionBoard.module.css
?? src/components/learning/ContentWorkspace.module.css
?? src/components/learning/ContentWorkspace.tsx
?? src/components/learning/QuestionBank.tsx
?? src/components/learning/SavedResources.tsx
?? src/components/learning/StudioWorkspace.tsx
?? src/components/practice/PracticeRevision.tsx
?? src/components/practice/QuestionBookmark.tsx
?? src/server/api/json-body.ts
?? src/server/auth/account-consent.ts
?? src/server/auth/recovery.ts
?? src/server/content/authoring-validation.ts
?? src/server/content/authoring.ts
?? src/server/content/coverage.ts
?? src/server/content/editorial.ts
?? src/server/content/import-preview.ts
?? src/server/content/saved-resources.ts
?? src/server/content/studio-validation.ts
?? src/server/content/studio.ts
?? src/server/journey/command-centre.ts
?? src/server/journey/schedule.ts
?? src/server/practice/revision.ts
?? src/server/question/authoring.ts
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/lesson-content.ts
?? src/shared/practice-recovery.ts
?? src/shared/study-calendar.ts
?? tests/auth/account-consent.test.ts
?? tests/auth/account-sessions.test.ts
?? tests/auth/recovery.test.ts
?? tests/content/authoring-routes.test.ts
?? tests/content/editorial.test.ts
?? tests/content/json-body.test.ts
?? tests/content/learning-ui.test.tsx
?? tests/content/saved-resources.test.ts
?? tests/content/studio-migration.test.ts
?? tests/content/studio-routes.test.ts
?? tests/content/studio-ui.test.tsx
?? tests/content/studio.test.ts
?? tests/foundation/postgres-target.test.ts
?? tests/postgres-live/identity.pg.test.ts
?? tests/postgres-live/read-only.setup.ts
?? tests/question/authoring.test.ts
?? tests/question/phase5-routes.test.ts
?? tests/question/phase5-ui.test.tsx
?? tests/question/recovery.test.ts
?? tests/question/revision-migration.test.ts
?? tests/question/revision.test.ts
?? tests/student/command-centre-routes.test.ts
?? tests/student/command-centre-ui.test.tsx
?? tests/student/command-centre.test.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
```
