# Phase 10: Full product verification evidence

Date: 2026-10-13 (Asia/Calcutta).
RESULT: INCOMPLETE / RELEASE BLOCKED. The requested exit is NOT MET.
No claim of real PostgreSQL integration, complete journeys or absence of critical
blockers is made. This increment verifies the safely available local evidence only.

## What was established

- Current branch main; HEAD 38f2c50ff893af29d130d3fc4919e8873356aa4f.
  Tests/build exercise the dirty working tree, NOT that committed revision alone.
  The deployed Railway artifact and its source revision were not identified.
- railway.json contains Railway build/start and /api/live deployment configuration.
  This is not proof of a live project, database, migration history or disposable target.
- Railway CLI 5.44.1 is installed. Read-only status --json through a secret-suppressed
  wrapper was unavailable; safe error classification identified authentication
  unavailable. No CLI login, project/environment link or cloud setting was changed.
- Normal .env DATABASE_URL has a loopback host pattern, not a Railway host pattern;
  its actual target remains unidentified. Values, hosts, usernames and secrets were
  never printed. .env.local and .env.production absent.
- .env.verification.local is missing. Offline postgres-preflight.ts refused before
  any database connection. Local inspection returned no loopback-port-15432 listener;
  this is not permission to connect to some other local/remote database.
- There are 20 migration SQL files in this checkout. No deployed/applied migration
  inventory was queried, and no file was executed. PostgreSQL read harness checks
  an EMPTY dedicated target only; it is not a migration or application integration
  harness and cannot be reused for a populated target by weakening its checks.
- Upstash REST URL/token and dedicated target marker/endpoint confirmation are absent
  in inspected local/process configuration. No values/fingerprints were printed.
- Existing browser surface inventory exposed no browsers/apps; creating an in-app
  browser returned Browser is not available. Playwright, @playwright/test and
  axe-core are absent from node_modules. Nothing was installed.
- Authentication/limiter/live verification/trusted-ingress/policy/guardian/recovery
  flags remain disabled locally. Payment/knowledge factories remain null.

Railway MAY host the application elsewhere; this run could not confirm it.
An existing hosted database is not assumed disposable. The ordinary local URL was
not substituted, and no unknown database was queried or modified.

## Release evidence matrix

PASS below refers ONLY to its stated evidence, never the full launch workflow.

| Area | Evidence this run | Acceptance status |
| --- | --- | --- |
| Full local regression suite | 1,555 passed / 2 live tests skipped; persistence/transactions/providers mocked | PASS offline only |
| TypeScript and Prisma schema | Fresh typecheck and offline schema validation pass | PASS offline only |
| Optimized application build | Isolated output; 64 generation entries, build TypeScript passes | PASS build only |
| Real migration replay/drift/constraints/triggers | No verified PostgreSQL target; all 20 SQL files unexecuted in this run | BLOCKED |
| Student signup/login/logout/recovery/consent/onboarding | Existing mocked tests pass, including STUDENT-only and policy boundaries; no authenticated journey | BLOCKED end to end |
| Goals, learning, saved resources and progress | Service/SSR regressions pass, no real persistence/browser/content inventory | BLOCKED end to end |
| Missions/sessions/practice/revision | Mocked ownership/scoring/replay tests pass; no database recovery evidence | BLOCKED real flows |
| Mocks, timers, autosave, expiry, duplicate finalization | Unit/recovery models pass; no multi-process DB locks or browser disconnect drill | BLOCKED real flows |
| Competitions/achievements/free-package entitlements | Mocked rules, privacy, grants and replay pass; no persisted operator/student journey | BLOCKED real flows |
| Guardian authorization/sharing/withdrawal/privacy | Existing consent/tenant regressions pass; no real guardian/student journey or legal sign-off | BLOCKED |
| Platform-admin publication/support/operations | Mocked permissions, CAS and notices pass; private anonymous APIs deny access | BLOCKED authenticated operation |
| School/teacher commercial journeys | Existing regressions retained; not included in agreed free student pilot | NOT REQUIRED for pilot |
| Security/privacy | Mocked privilege/ownership/origin/protected-answer/error tests and anonymous guards pass | PARTIAL, not comprehensive live audit |
| Concurrency/failure recovery | Serialized mock fixtures/recovery helpers pass | BLOCKED PostgreSQL/network/restore acceptance |
| Mobile/keyboard/screen reader/accessibility | Initial SSR tests only; no usable browser/installed browser harness | NOT RUN acceptance |
| Real performance/load/capacity | Build success is not a performance benchmark; no real workload/DB | NOT RUN |
| Payments/webhooks/receipts/refunds | Factory disabled; local empty webhook fails closed 503; provider tests mocked | Paid acceptance NOT REQUIRED for free pilot, NOT VERIFIED for future paid launch |
| Trusted Railway ingress/live Upstash | CLI access unavailable; dedicated test credentials/confirmation missing | BLOCKED |
| Monitoring/backup/restore | Runbook exists; no actual provisioning/drill/alert delivery | BLOCKED release evidence |
| Licensed reviewed launch content/policy | No actual library inventory or qualified approval supplied/verified here | BLOCKED readiness |

## Actual commands and outcomes

All external live tests were explicitly disabled ONLY in the test child process;
the ordinary application configuration was not changed.

```powershell
node node_modules/tsx/dist/cli.mjs postgres-preflight.ts
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
npm.cmd run typecheck
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','validate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase10',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false'}}); process.exit(r.status??1)"
git diff --check
```

Preflight: EXPECTED REFUSAL, exit 1 because dedicated configuration missing.
Full suite: PASS, 1,555 tests / 79 files; 2 gated live tests / files skipped.
Typecheck: PASS before and after isolated build.
Offline Prisma validate: PASS. Client generation was not rerun this increment.
Build: PASS, 64 generation entries; no DB application query or provider activation.
Whitespace: PASS; existing LF/CRLF/global-ignore permission warnings remain.
Expected sanitized Unhandled API error logs are intentionally failing mock-service
tests, not observed infrastructure failures. No new application failure was reproduced
in these available checks; that does NOT establish no critical product blockers.

## Runtime smoke: database-free only

Preview started with an unreachable PLACEHOLDER datasource, never the normal local
or any Railway database. Earlier output/previews retained.

```powershell
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3016'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase10',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false'}}); process.exit(r.status??1)"
```

http://127.0.0.1:3016/packages: protected, login redirect expected; NOT a live-data demo.
Anonymous student progress, commerce with forged identity/role, notifications, admin
operations and portal workspace GET: 401. /progress, /get-help, /parent, /consent,
/packages and /admin/operations: 307. Process-only /api/live: 200.
Empty local POST /api/payments/razorpay: 503, sanitized disabled-service response.
No signature/token, charge, provider HTTP request, authenticated write or DB query.
Fetch used manual redirects. No signup/login, DB /api/health, migration or restore
endpoint was requested. Anonymous redirects are not complete browser journeys.

## Release blockers and safe continuation

R1: A positively identified disposable PostgreSQL target is unavailable. Missing
configuration and inaccessible Railway account cannot be fixed by guessing credentials
or using the ordinary database. The full migration/fixture/persistence workload needs
a guarded launcher and target-specific identity/write approval. Existing read-only
empty-target guards must remain intact, separate from populated integration checks.

R2: Authenticated student/guardian/admin end-to-end and concurrent/recovery verification
depend on that target, controlled fixtures and an actual browser harness. Do not set
production approval flags to make tests pass. Any test-only adapter/configuration must
be isolated from production and explicitly reviewed before use.

R3: Live authentication protection/recovery needs dedicated Upstash identity/config,
trusted-ingress evidence and approved delivery capability. Local placeholders, CLI
availability and mock success do not verify hosted ingress, identity or delivery.

R4: Mobile/accessibility/performance acceptance requires a browser/tooling environment,
approved workload and actual data-backed journeys. No package install, resource
provisioning, load test or production probing was undertaken without that boundary.

R5: Actual reviewed/licensed content, guardian/legal procedures, human support ownership,
monitoring alert delivery and isolated backup/restore drills remain unverified release
prerequisites. Runbooks are procedures, not completion evidence.

R6: Working tree contains accumulated uncommitted Phases 1-9. Freeze/review a complete
source/artifact before final acceptance; do not claim this tested tree matches GitHub
or a Railway release. Remote synchronization/deployment revision was not verified.

Next safe action is to obtain authenticated Railway read access or establish the
previously scoped local disposable environment, then positively identify and isolate
the target before guarded migration/fixture testing. No new user question or
credential disclosure is required by this report; no coding expertise is assumed.
Account authorization and unknown/billable database changes cannot be fabricated.

## Files and preservation

Manual code change: next.config.ts adds .next/phase10-verification output selector,
preserving existing selectors/default. No product features/permissions/guards relaxed.
Next generated Phase 10 next-env.d.ts references and added tsconfig includes;
older verification includes remain. No schema, historical SQL or test cases changed.
This report, MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md record
incomplete acceptance without overwriting earlier evidence.

Start: 226 expanded dirty paths (85 tracked, 141 untracked).
End: 227 (85 tracked, 142 untracked), including this report.
Original 15 staged paths preserved; no stage/commit/push/reset/stash/branch change.
No DB connection, migration, seed, data fixture, import, data deletion, dependency
installation, cloud provisioning, CLI login/link, production activation or deployment.
No environment secret, connection value or target fingerprint printed.
Railway credentials/database remain untouched. Only isolated local app preview started.

## Proposed commit/push commands (NOT EXECUTED)

Review the complete prior feature dependencies and the 15 already-staged paths before
committing. These whole-file selections include prior edits in shared config/docs.
Do not stage credential files or use git add .; this is not a release-approved commit.

```powershell
git status --short
git add -- FULL_PRODUCT_VERIFICATION_PHASE10.md MASTER_BUILD_STATUS.md CONTROLLED_VERIFICATION_REPORT.md next.config.ts next-env.d.ts tsconfig.json
git diff --cached --stat
git diff --cached
git commit -m "Record partial Phase 10 verification and release blockers"
git push origin main
```

Neither staging, commit nor push was executed. A reviewed complete source snapshot,
not just this metadata increment, is required for subsequent release acceptance.

## Full expanded Git inventory

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
 M src/app/admin/page.tsx
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
 M src/components/commerce/CommerceWorkspace.tsx
 M src/components/competition/CompetitionWorkspace.tsx
 M src/components/journey/GetHelp.tsx
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
 M src/server/commerce/access.ts
 M src/server/commerce/service.ts
 M src/server/commerce/validation.ts
 M src/server/competition/achievements.ts
 M src/server/competition/service.ts
 M src/server/content/service.ts
 M src/server/help/service.ts
 M src/server/journey/planner.ts
 M src/server/journey/service.ts
 M src/server/journey/validation.ts
 M src/server/mock/service.ts
 M src/server/mock/validation.ts
 M src/server/operations/service.ts
M  src/server/portal/authorization.ts
MM src/server/portal/service.ts
 M src/server/practice/service.ts
 M src/server/question/service.ts
 M src/server/sia/service.ts
 M src/server/student/service.ts
 M src/server/student/validation.ts
 M tests/auth/hardening-routes.test.ts
 M tests/auth/signup-route.test.ts
 M tests/auth/signup-ui.test.ts
 M tests/auth/validation.test.ts
 M tests/commerce/provider.test.ts
 M tests/commerce/service.test.ts
 M tests/competition/service.test.ts
 M tests/content/service.test.ts
 M tests/mock/routes.test.ts
 M tests/mock/service.test.ts
M  tests/portal/authorization.test.ts
MM tests/portal/lifecycle.test.ts
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
?? COMMERCE_OPERATIONAL_COMPLETION_PHASE9.md
?? COMPETITIONS_SUPPORT_PARTNERSHIPS_PHASE8.md
?? CONTENT_KNOWLEDGE_STUDIO.md
?? DAILY_STUDY_COMMAND_CENTRE.md
?? EXAM_CATALOGUE_LEARNING.md
?? LAUNCH_FOUNDATION.md
?? LAUNCH_OPERATIONS_RUNBOOK.md
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
?? prisma/migrations/20261011000300_engagement_support/migration.sql
?? prisma/migrations/20261013000100_free_pilot_packages/migration.sql
?? src/app/account/consent/page.tsx
?? src/app/account/guardian-consent/page.tsx
?? src/app/admin/accounts/page.tsx
?? src/app/admin/content/page.tsx
?? src/app/admin/operations/page.tsx
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
?? src/app/api/admin/operations/route.ts
?? src/app/api/auth/guardian-consent/check/route.ts
?? src/app/api/auth/recovery/route.ts
?? src/app/api/auth/reset-password/route.ts
?? src/app/api/student/command-centre/choices/route.ts
?? src/app/api/student/command-centre/route.ts
?? src/app/api/student/notifications/route.ts
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
?? src/components/commerce/LaunchOperations.tsx
?? src/components/journey/MissionBoard.module.css
?? src/components/journey/NotificationInbox.tsx
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
?? src/server/notifications/service.ts
?? src/server/operations/launch.ts
?? src/server/practice/revision.ts
?? src/server/question/authoring.ts
?? src/server/sia/actions.ts
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/entitlement-state.ts
?? src/shared/lesson-content.ts
?? src/shared/mock-recovery.ts
?? src/shared/practice-recovery.ts
?? src/shared/progress-evidence.ts
?? src/shared/study-calendar.ts
?? tests/auth/account-consent.test.ts
?? tests/auth/account-sessions.test.ts
?? tests/auth/recovery.test.ts
?? tests/commerce/operations-routes.test.ts
?? tests/commerce/operations-ui.test.tsx
?? tests/commerce/operations.test.ts
?? tests/commerce/pilot-migration.test.ts
?? tests/commerce/pilot.test.ts
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
?? tests/student/engagement-migration.test.ts
?? tests/student/engagement-ui.test.tsx
?? tests/student/notification-routes.test.ts
?? tests/student/notifications.test.ts
?? tests/student/progress-evidence.test.ts
?? tests/student/progress-routes.test.ts
?? tests/student/progress-service.test.ts
?? tests/student/progress-ui.test.tsx
?? tests/student/sia-actions.test.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
?? FULL_PRODUCT_VERIFICATION_PHASE10.md
```
