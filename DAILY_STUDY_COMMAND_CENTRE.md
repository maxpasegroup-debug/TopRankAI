# Daily Study Command Centre

Phase 4 implementation evidence, 2026-10-11 (Asia/Calcutta).
Code increment completed; production/student acceptance exit NOT VERIFIED.
No reviewed launch library or approved database was accessed.

## Completed

- Existing /home MissionBoard now has Today, Week, selected-day and Overdue views,
  seven-day capacity summaries, timezone and week selection, activity navigation,
  task planning, session timer and recent weekly session history.
- India, UAE and UTC calendar options; server validates timezone/date parameters.
  Overdue is derived from unfinished dated tasks, never an automatic completion
  or silent task-status mutation. Students explicitly skip, restore or reschedule.
- Weekly preview and confirmation reuse existing goals, plans and owner-bound
  request keys. Confirmation archives the previous active plan, retaining its
  task/progress history. A visible confirmation warning explains that unfinished
  missions are NOT automatically carried forward.
- Automatic previews use distinct available lessons and reviewed practice, at
  most 21 activities, at most three per day and at most 45 minutes per block.
  They do not fill a thin curriculum by repeating the same lesson seven times.
  Unallocated time remains free. Reviewed practice can support a plan without
  published lessons. Paid lessons require current entitlement before preview.
- Manual lesson/practice task creation derives title, subject and destination
  from server-validated canonical records for the plan exam. No arbitrary href,
  ownership, title, role, publication or completion claims are accepted.
- New tasks are keyed uniquely within their plan; changed replay payloads conflict.
  Manual additions cap the active plan at 100 tasks.
- Completion, skipping, restoration, study-date changes and duration edits reuse
  optimistic versions and transactionally recorded mission events. Inactive or
  foreign plan tasks cannot be edited. Rescheduling a completed task preserves
  its completion timestamp rather than manufacturing a new completion.
- Non-skipped planned minutes, including completed missions, count toward the
  daily budget. Additions, reschedules, duration changes and skipped-task restores
  check capacity inside serializable transactions; conflicts require reload.
- Revision-to-mission uses the existing protected mock/review engine and finds
  the first day with 15 spare minutes in the next seven India-calendar days.
  No spare capacity produces an actionable validation error, not an overloaded day.
- Sessions optionally reference an owned unfinished active mission. Sessions do
  NOT automatically complete missions, lessons or mastery. Existing server timing,
  stop ownership and current-session recovery remain; reused keys for different
  topics/task links conflict. A live elapsed timer and 12-hour credit-cap notice
  accompany the actual persisted session record.
- Existing progress and parent/reporting semantics stay intact: recorded session
  minutes, manually completed tasks and lesson completion are separate evidence.

## Files and Routes

- src/components/journey/MissionBoard.tsx and MissionBoard.module.css.
- src/shared/study-calendar.ts: local calendar dates, day shifts and minute clamp.
- src/server/journey/planner.ts, validation.ts, service.ts, schedule.ts and
  command-centre.ts.
- /api/student/command-centre: private weekly overview and task creation.
- /api/student/command-centre/choices: bounded available lesson/practice choices.
- /api/student/missions/preview: optional validated weekly start date.
- Existing /missions and /study-sessions endpoints retained.
- src/server/mock/service.ts: capacity-aware revision mission scheduling only.
  Protected snapshots, scoring, answer visibility and result policy unchanged.
- prisma/schema.prisma and new forward-only migration
  20261011000100_daily_study_command_centre/migration.sql.
- next.config.ts/tsconfig.json: isolated Phase 4 verification output, preserving
  earlier output settings; Next-generated default next-env imports restored.
- New command-centre service/route/rendering tests; existing journey and mock
  fixtures updated for distinct planning and capacity checks.
- MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md updated additively.

## Migration Safety

New nullable MissionTask.requestKey and StudySession.taskId; unique plan/request
key and restrictive session/task FK. New partial unique indexes enforce one
running session and one active plan per user.

Migration is NOT APPLIED. It intentionally aborts if legacy overlapping running
sessions or active plans exist; it does not delete, repair or rewrite user data.
Legacy-row assessment and an explicitly approved resolution are prerequisites
before writes/migration execution. Historical migrations were not changed.
No database connection, migration, seed or data import occurred.

## Verification

~~~powershell
npx.cmd vitest run tests/student tests/mock tests/content tests/auth
# PASS: 614 tests, 1 gated live test skipped; 37 files passed, 1 skipped.
npm.cmd test
# PASS: 1,209 tests, 2 gated tests skipped; 57 files passed, 2 skipped.
npm.cmd run typecheck
# PASS.
npm.cmd run prisma:generate
# PASS: local Prisma 7.10.0 client generation, no database connection.
npx.cmd prisma validate --config prisma7.config.ts
# PASS.
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase4'}});process.exit(r.status??1)"
# PASS: isolated optimized Next.js build, including final source changes.
git -c core.safecrlf=false diff --check
# PASS.
~~~

36 additional unit/rendering cases versus the previous 1,173-test baseline.
Cases include distinct/empty curricula, practice-only planning, India/UAE midnight,
overdue derivation, bounds/truncation, daily budget, stale versions, preserved
completion time, canonical/paid/foreign activities, retries, revision capacity,
session ownership/key mismatch, API auth/origin/injection/privacy/error boundaries
and static shell rendering/escaping.
Default onboarding starts use the India-calendar date, covered at the UTC boundary.

Initial failures were fixture expectations for repeated lessons/old task scopes,
a no-op date incorrectly tested as a reschedule, and a missing Prisma mock in the
new route suite. The mock omission failed environment validation before connection;
no database was reached. Fixtures and test isolation were corrected; final runs pass.

All persistence/concurrency/rollback checks are mocked. Migration tests read SQL
only. No live PostgreSQL integration or authenticated browser acceptance is claimed.
The two gated infrastructure tests remain skipped.

Local built preview: http://127.0.0.1:3010/home. Port 3009 was occupied and left
untouched. Anonymous Home redirects (307); command-centre GET/choices GET and
task POST reject (401). No credentials or authenticated mutation were submitted.
This is HTTP boundary evidence, not student/browser workflow verification.

## Remaining Limitations and Release Gates

- Actual reviewed, published launch content and an approved isolated PostgreSQL
  target are required for meaningful student acceptance. No content was fabricated
  or imported. Production authentication, payments and messaging remain disabled.
- Real serializable races, partial indexes, session persistence/recovery and
  student/parent progress agreement require guarded PostgreSQL verification.
- Desktop/mobile authenticated acceptance is still pending. CSS uses bounded,
  wrapping grids; rendering tests are not browser layout/interaction tests.
- Timezone selection is not persisted in the student profile. The board defaults
  to India; UAE students may select Asia/Dubai. Revision automatic scheduling uses
  India-calendar dates; students can subsequently reschedule within capacity.
- Sessions are self-recorded elapsed time, NOT proof of continuous attention.
  Credit is bounded to 720 minutes per session, consistently with existing
  progress/reporting. Weekly credit is attributed to the local completion date,
  not split over midnight. Existing profile totals cover the latest 100 sessions.
- Weekly sessions query a bounded timezone-safe UTC buffer, display only matching
  local-week records and explicitly flag partial totals above its 100-row limit.
- Active mission reads are bounded to 500 tasks; the board warns at that boundary.
  Available content choices are sampled, not a comprehensive catalogue; full
  browsing remains in the learning/practice workspaces.
- Legacy over-budget days are visibly identified, not silently rewritten. Existing
  long-duration tasks can be shortened; new/edited durations use 5-120 minutes.
- Archived-plan unfinished missions/revision associations are not automatically
  transferred into a replacement plan. Historical task events capture status/date,
  not full duration-change snapshots.
- No actual plan readiness, topic mastery, exam score or rank is inferred.

## Execution and Git

Current branch main; existing modified, untracked and staged work preserved.
No branch switch, staging, commit, push, deployment, dependency installation,
database connection, migration, seed or import execution occurred.
The 15 pre-existing staged paths remain unchanged.
Safe flag inspection reports disabled authentication activation/live/proxy
verification, policy/guardian approval and recovery delivery. No secrets printed.

## Commit and Push Commands

Commands are provided for operator review only, NOT executed. Phase 4 depends on
the earlier uncommitted account/content increments; include or commit those
prerequisites using their reports first. Shared files contain earlier changes.
Review the entire existing index before committing its 15 already-staged entries.

~~~powershell
$phase4Files = @(
  'DAILY_STUDY_COMMAND_CENTRE.md',
  'MASTER_BUILD_STATUS.md', 'CONTROLLED_VERIFICATION_REPORT.md',
  'next.config.ts', 'tsconfig.json', 'prisma/schema.prisma',
  'prisma/migrations/20261011000100_daily_study_command_centre/migration.sql',
  'src/components/journey/MissionBoard.tsx',
  'src/components/journey/MissionBoard.module.css',
  'src/shared/study-calendar.ts',
  'src/server/journey/planner.ts', 'src/server/journey/validation.ts',
  'src/server/journey/service.ts', 'src/server/journey/schedule.ts',
  'src/server/journey/command-centre.ts', 'src/server/mock/service.ts',
  'src/app/api/student/missions/preview/route.ts',
  'src/app/api/student/command-centre/route.ts',
  'src/app/api/student/command-centre/choices/route.ts',
  'tests/student/journey.test.ts', 'tests/mock/service.test.ts',
  'tests/student/command-centre.test.ts',
  'tests/student/command-centre-routes.test.ts',
  'tests/student/command-centre-ui.test.tsx'
)
git status --short
git diff -- $phase4Files
git add -- $phase4Files
git diff --cached
git commit -m "Complete daily study command centre workflows"
git push origin main
~~~

Next: guarded student workflow acceptance on the explicitly approved disposable
database once reviewed content is available; do not activate production.

## Final Git Inventory

143 dirty-tree entries including 15 preserved prior staged paths.
This includes earlier increments and user work; it is not a staging list.

~~~text
 M .gitignore
AM CONTROLLED_VERIFICATION_REPORT.md
MM MASTER_BUILD_STATUS.md
M  PORTALS_CONSENT_TENANTS.md
 M next.config.ts
A  prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
A  prisma/migrations/migration_lock.toml
 M prisma/schema.prisma
M  src/app/[[...path]]/page.tsx
 M src/app/api/auth/signup/route.ts
 M src/app/api/student/content/chapters/[chapterSlug]/lessons/route.ts
 M src/app/api/student/content/lessons/[lessonSlug]/route.ts
 M src/app/api/student/missions/preview/route.ts
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/MissionBoard.tsx
 M src/components/journey/OperationsWorkspace.tsx
MM src/components/portal/PortalWorkspace.tsx
MM src/screens/AuthPages.tsx
 M src/screens/Learn.tsx
 M src/screens/Settings.tsx
 M src/screens/learning/LessonExperience.tsx
 M src/screens/learning/SubjectWorkspace.tsx
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
?? src/components/learning/SavedResources.tsx
?? src/components/learning/StudioWorkspace.tsx
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
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/lesson-content.ts
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
?? tests/student/command-centre-routes.test.ts
?? tests/student/command-centre-ui.test.tsx
?? tests/student/command-centre.test.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
~~~
