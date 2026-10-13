# Phase 7: Progress, digital profile and SIA

Date: 2026-10-11 (Asia/Calcutta). A coherent code increment is delivered.
Student production exit remains NOT accepted pending database/browser/content gates.

## Delivered

- Existing /progress now shows a private digital profile with saved exam/year/goal,
  existing completed-mission and marked-complete lesson counts, practice submissions
  and accuracy, finalized mock count, saved lessons and existing achievement history.
- Timezone-aware rolling 28-day evidence: four seven-day rows, session minutes,
  mission/lesson completions, practice accuracy, finalized mock accuracy on answered
  questions, subject-level practice results and distinct-question counts.
- Recent validated mock score summaries and a 30-entry learning timeline connect
  to canonical history/results, lessons catalogue, study board and revision.
- India/UAE/UTC calendar controls, refresh/retry, empty states, explicit sampling
  and invalid-result warnings, escaped user/content text, bounded scrollable weekly
  table and wrapping long names. No rank prediction, mastery percentage or invented
  achievement. Different questions/mocks are not claimed directly comparable.
- Existing deterministic SIA now checks due mission canonical URLs against current
  published lesson hierarchy/exam or reviewed scored practice; lesson entitlements
  are enforced. Unsupported/external/stale links are not recommended.
- Priority: available due mission, available pending incorrect practice revision,
  saved pending mock revision, future-board scheduling, accessible unfinished lesson,
  reviewed practice fallback, then competition eligibility review or an honest
  no-available-action state. Former-exam plan missions are ignored. No new missions,
  completion or mastery are fabricated from guidance.
- Guidance is shared by the private progress response and existing SIA/Get Help
  endpoint. Responses retain deterministic source and externalProviderConnected=false,
  with explicit DISABLED_PENDING_APPROVAL status. No AI integration was added.

## Architecture and ownership

Canonical models/services reused. getVerifiedProgress retains its existing contract;
getStudentEvidence consolidates it without replacing the learning/scoring engines.
All new counts/record reads derive userId from the authenticated student, never query
parameters. Private studentRead wrappers enforce authentication/role and no-store.
No parent/institution access policy or shared profile was broadened.

Practice queries select correctness/timestamps and subject metadata, not submitted
answers, explanation keys or answer options. Mock queries select finalized result
JSON but not protected snapshots/answers. A Zod decoder strips non-summary fields
and checks scalar types, positive maximum score, correct <= answered <= total and
score <= maximum. Raw JSON, outcomes, keys and explanations are never returned here.
NEVER-policy mock aggregate scores remain consistent with existing publicResult;
this view adds no per-question correctness or explanation disclosure.

Counts: all recorded exams; no official percentile or comparable exam ranking.
Practice accuracy counts submissions, including retries. Distinct questions are
reported separately. Zero submissions means unknown accuracy, not 0% or 100% mastery.
Weekly mock accuracy weights correct answers by answered questions, not an unweighted
average of percentages. Negative marks remain actual stored scores.

No schema/migration added. Existing unapplied migrations remain required and untouched.
No database connection, migration, seed, import or content publication was executed.

## Important files

- src/shared/progress-evidence.ts: bounded calendar rollups and safe mock decoder.
- src/server/journey/progress.ts: owner-scoped consolidated private evidence reads.
- src/server/sia/actions.ts: canonical published/exam/entitlement availability.
- src/server/sia/service.ts: deterministic prioritized next-action guidance.
- src/app/api/student/{progress,sia}/route.ts: canonical private reads with timezone.
- src/components/journey/ProgressDashboard.tsx: digital profile and evidence view.
- tests/student/{progress-evidence,progress-service,progress-routes,sia-actions}.test.ts,
  progress-ui.test.tsx and sia.test.ts: regression coverage.
- next.config.ts: isolated Phase 7 build output. Next updated generated next-env
  references and appended Phase 7 tsconfig type includes, retaining earlier includes.
- MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md: evidence updated.

## Actual verification

```powershell
npx.cmd vitest run tests/student tests/mock tests/question tests/portal
npm.cmd test
npm.cmd run typecheck
npx.cmd prisma validate --config prisma7.config.ts
npx.cmd prisma generate --config prisma7.config.ts
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase7'}}); process.exit(r.status??1)"
git diff --check
```

Final results: focused 715 passed (38 files); full 1,384 passed / 2 gated tests skipped
(70 files passed / 2 skipped). Phase 6 baseline was 1,305 passing: 79 added tests.
TypeScript, offline Prisma validation/client generation, isolated optimized build
(62 static-generation entries), whitespace PASS. An intermediate SIA test lacked a
DB module mock after adding the role guard, causing environment validation failure;
the mock was added, no DB connected, and final reruns passed. A deliberately failing
API service emits the existing sanitized Unhandled API error log in error-response
tests; this is not a live service failure and secrets are not logged.

Rollup tests verify empty evidence, repeated/distinct questions, dates, sessions,
timezone boundaries, invalid results, aggregate stripping and timeline bounds.
Service/route tests verify authenticated ownership, roles, no-store, ignored forged
identity, protected projections, bounds and sanitized errors. SIA tests verify
availability, retired/missing/gated lessons, infrastructure-error propagation,
reviewed scored practice, target exams, future missions, revision and disabled AI.
UI tests render initial shells and controlled evidence fixtures. No authenticated
desktop/mobile browser acceptance, PostgreSQL persistence or live AI is claimed.

Preview was started with:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3013'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase7'}}); process.exit(r.status??1)"
```

http://127.0.0.1:3013/progress is protected; login redirect expected.
Anonymous GET /api/student/progress, forged-user UTC progress query, /api/student/sia:
401. GET /progress and /get-help: 307. No authenticated mutation, signup/login,
health/DB endpoint or external service was invoked. Earlier previews preserved.

## Limits and release prerequisites

1. Explicitly approved disposable PostgreSQL migration/persistence verification and
   authenticated desktop/mobile progress/SIA acceptance remain pending. No target
   approval or database activity occurred in this increment.
2. Period reads retain at most 1,000 sessions/missions/lesson completions/practice
   attempts and 100 mocks, with per-stream truncation flags. Timeline latest 30,
   result list latest 10. Existing saved lessons/legacy sessions retain 100 limits.
   SIA checks first 20 due tasks and 20 unfinished lesson candidates; revision
   retains prior canonical bounded history. No full-history export introduced.
3. Counts/streams are separate reads, not a transactionally consistent snapshot.
   Concurrent changes may produce short-lived differences. All-time completion
   counts reflect current marked-complete state, not lifetime completion events.
   Reopening a mission/lesson removes its current completion evidence. Session
   minutes are recorded elapsed time (clamped to 12 hours/session), not proof of
   active attention. No immutable certified Student Success Passport is claimed.
4. Historical practice subject/mock labels use current canonical catalogue metadata;
   scored results remain stored/frozen. Activity spans all recorded exams. No
   psychometric normalization, longitudinal mastery or predicted rank model added.
5. Existing pending schema changes must be verified, and licensed educator-reviewed
   launch content must be supplied. Legacy review/provenance audit remains required.
   Missing publication/access stops guidance; infrastructure failures propagate to
   the standard sanitized unavailable/error state, rather than inventing success.
6. Live AI requires explicit approval of privacy/data minimization, consent and
   retention, provider boundaries, quality/grounding/evaluation, student safety,
   quotas/cost ceilings and a kill switch before integration/activation. None is
   signed off here. No student data was sent to an AI provider. Existing knowledge
   adapter factory remains null; no indexing/retrieval success claimed.
7. Local/process auth limiter activation/live verification/trusted ingress and
   account-policy/guardian/recovery approval gates were checked disabled without
   revealing values. Existing production auth remains fail-closed; payments remain
   disabled by the null provider factory. Deployed configuration not inspected.
   Railway ingress, real provider verification and compliance sign-off remain gates.

## Git and proposed commands

Branch main. Final status: 191 paths (72 tracked dirty, 119 untracked).
The original 15 staged paths remain unchanged. No staging, commit, push, branch
change, reset, stash, deployment, install, data write or production activation.
All earlier work and reports retained. Full status inventory follows below.

These commands are NOT executed. Review the existing index and earlier uncommitted
dependencies first; a Phase 7-only commit may omit required prior modules. Never
use git add . on this mixed tree.

```powershell
git status --short --untracked-files=all
git diff --cached --stat
git add -- src/shared/progress-evidence.ts src/server/journey/progress.ts src/server/sia/actions.ts src/server/sia/service.ts src/components/journey/ProgressDashboard.tsx src/app/api/student/progress/route.ts src/app/api/student/sia/route.ts tests/student/sia.test.ts tests/student/sia-actions.test.ts tests/student/progress-evidence.test.ts tests/student/progress-service.test.ts tests/student/progress-routes.test.ts tests/student/progress-ui.test.tsx next.config.ts next-env.d.ts tsconfig.json PROGRESS_DIGITAL_PROFILE_SIA.md MASTER_BUILD_STATUS.md CONTROLLED_VERIFICATION_REPORT.md
git diff --cached --check
git diff --cached --stat
git commit -m "Connect progress evidence, digital profile and deterministic SIA"
git push origin main
```

Next release gate: approved isolated-database and authenticated-browser acceptance
of consolidated progress and next-action availability. No next phase was started.

## Final Git inventory

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
 M src/app/api/student/progress/route.ts
 M src/app/api/student/sia/route.ts
 M src/app/practice/mock-attempts/page.tsx
 M src/app/practice/revision/page.tsx
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/MissionBoard.tsx
 M src/components/journey/OperationsWorkspace.tsx
 M src/components/journey/ProgressDashboard.tsx
 M src/components/journey/client.ts
 M src/components/mock/AdminMocks.tsx
 M src/components/mock/StudentMocks.tsx
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
 M src/server/mock/validation.ts
 M src/server/operations/service.ts
M  src/server/portal/authorization.ts
M  src/server/portal/service.ts
 M src/server/practice/service.ts
 M src/server/question/service.ts
 M src/server/sia/service.ts
 M src/server/student/service.ts
 M src/server/student/validation.ts
 M tests/auth/hardening-routes.test.ts
 M tests/auth/signup-route.test.ts
 M tests/auth/signup-ui.test.ts
 M tests/auth/validation.test.ts
 M tests/content/service.test.ts
 M tests/mock/routes.test.ts
 M tests/mock/service.test.ts
M  tests/portal/authorization.test.ts
M  tests/portal/lifecycle.test.ts
A  tests/portal/migration-contract.test.ts
A  tests/portal/workspace.test.ts
 M tests/question/attempts.test.ts
 M tests/student/journey.test.ts
 M tests/student/operations.test.ts
 M tests/student/service.test.ts
 M tests/student/sia.test.ts
 M tsconfig.json
 M vitest.config.ts
?? AGENTS.md
?? CLAUDE.md
?? CONTENT_KNOWLEDGE_STUDIO.md
?? DAILY_STUDY_COMMAND_CENTRE.md
?? EXAM_CATALOGUE_LEARNING.md
?? LAUNCH_FOUNDATION.md
?? PRACTICE_MISTAKE_TO_MASTERY.md
?? PROGRESS_DIGITAL_PROFILE_SIA.md
?? STUDENT_ACCOUNTS_ONBOARDING.md
?? TIMED_MOCK_EXAMS_PHASE6.md
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
?? src/server/journey/progress.ts
?? src/server/journey/schedule.ts
?? src/server/practice/revision.ts
?? src/server/question/authoring.ts
?? src/server/sia/actions.ts
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/lesson-content.ts
?? src/shared/mock-recovery.ts
?? src/shared/practice-recovery.ts
?? src/shared/progress-evidence.ts
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
?? tests/mock/recovery.test.ts
?? tests/mock/ui.test.tsx
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
?? tests/student/progress-evidence.test.ts
?? tests/student/progress-routes.test.ts
?? tests/student/progress-service.test.ts
?? tests/student/progress-ui.test.tsx
?? tests/student/sia-actions.test.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
```
