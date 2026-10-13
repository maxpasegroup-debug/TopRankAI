# Phase 9: Commerce and operational completion

Date: 2026-10-13 (Asia/Calcutta).
Free invited pilot code increment delivered; release exit NOT accepted.
JEE Main + NEET UG / India and UAE. Payments, live AI and external messaging stay disabled.

## Completed pilot scope

- Canonical immutable CommercePackage supports amountMinor=0 only with ONCE
  fixed-duration access. Positive paid package validation remains compatible;
  orders, payments, refunds and receipts retain strictly positive financial amounts.
- Administrator-only pilotGrant expands a currently published available free package
  into canonical ADMIN entitlements for an existing active STUDENT. Package features
  and duration are server-derived; forged source/status/features/end-time are rejected.
  No public self-claim, order, capture, receipt, tax invoice or subscription is created.
- All feature grants, minimal audits and one generic IN_APP notice are in the same
  bounded serializable transaction. UUID provenance includes package/feature and
  immutable original-reason intent; mutable revocation reasons do not break replay.
- Replays retain original windows, do not notify/audit again or resurrect revoked
  grants. Changed target/package/start/reason and incomplete historical bundles
  conflict. Retirement/expiry do not prevent a harmless original replay.
- Operator can search exact student ID and lifecycle window, inspect effective access
  and withdraw individual feature grants with a reason. Repeat withdrawal is harmless.
  Other overlapping grants are unchanged. Pilot notices never enqueue external delivery.
- requireFeature now requires an owned CAPTURED purchase, not PARTIALLY_REFUNDED,
  matching the existing any-confirmed-refund revocation policy. ADMIN/TRIAL provenance
  and half-open windows remain. Historical owned mock attempts/results are preserved.
- Student access distinguishes scheduled, expired, revoked and blocked records;
  raw order/provenance/administrative reasons are not exposed in the student DTO.
  Purchase of free packages is rejected even with an injected sandbox test provider.
- /packages shows free invited access and disabled purchase. Admin commerce contains
  a working package-bundle invitation form and links to entitlement history.
  Provider-dependent refund/event actions visibly disabled while the factory is null.
- /admin/operations provides aggregate queue indicators, exact-ID/time-window grant
  filters, 25-item stable pagination with sentinel, generic refresh/retry and per-feature
  withdrawal. CURRENT is a lifecycle window filter and includes blocked purchases.
- Unified administrator audit summary filters exact entity/action and omits actor
  identity, private free-form detail and provider metadata. Authentication/role/origin
  boundaries and no-store wrappers are reused; client role claims cannot authorize.
- Runtime configuration flags are explicitly separate from external acceptance.
  Queue counters are live sampled observations, not an accounting ledger or SLA.
  Support remains the Phase 8 versioned queue; no fake assignment/safeguarding system.
- LAUNCH_OPERATIONS_RUNBOOK.md prepares monitoring, backup encryption/retention and
  isolated restore, deployment/migration approval, recovery and incident procedures.
  It names human evidence/ownership prerequisites without fabricating deployed services.

## Important files and routes

Server: src/server/commerce/{validation,service,access}.ts,
src/server/operations/launch.ts, src/shared/entitlement-state.ts,
src/server/notifications/service.ts.
UI: src/components/commerce/{CommerceWorkspace,LaunchOperations}.tsx;
src/app/admin/page.tsx, src/app/admin/operations/page.tsx.
API: /api/admin/operations GET (overview/access/audit) and existing
/api/admin/commerce POST pilotGrant/revoke. /api/student/commerce remains student-only.
Student offering /packages; operator /admin/commerce, /admin/operations and /admin.
Tests: five new tests/commerce/{pilot,operations,operations-routes,pilot-migration,
operations-ui} files; existing provider/service expectations updated deliberately.
next.config.ts isolates Phase 9 builds; Next-generated next-env.d.ts and tsconfig.json
references updated, retaining previous verification includes.
MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md updated, not overwritten.

## Migration: CREATED, NOT APPLIED

prisma/migrations/20261013000100_free_pilot_packages/migration.sql changes only the
package CHECK constraint in an explicit transaction, allowing zero/fixed free access
and preserving prior currency/window/features/duration/status limits.
No historical SQL modified, no new Prisma model/field or generated schema change.
Positive-money financial constraints and immutable terms triggers remain unchanged.
All previous pending migrations are still dependencies. No DB migration/seed/import ran.

## Actual verification

```powershell
npx.cmd vitest run tests/commerce tests/content tests/student tests/mock
npm.cmd test
npm.cmd run typecheck
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','validate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','generate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase9'}}); process.exit(r.status??1)"
git diff --check
```

PASS: focused 744 tests / 43 files. Full 1,555 passed / 2 gated live tests skipped
(79 passing files, 2 skipped). 94 additions over Phase 8's 1,461.
TypeScript, offline Prisma validation/generation, isolated optimized production build
(64 static-generation entries) and whitespace checks PASS.
No PostgreSQL connection is needed for validate/generate; placeholder datasource
deliberately overrides normal configuration for those commands.

Intermediate findings resolved:
- Old provider test assumed every package price must be positive; updated to accept
  fixed free packages while financial money/refund validation still rejects zero.
- A new withdrawal/replay test exposed mutable reason comparison; original invitation
  intent is now immutable provenance, so withdrawal is retained and safe retry succeeds.
- TypeScript fixture exposed Next's required NODE_ENV ProcessEnv augmentation; the pure
  flag inspector now accepts a readonly string/undefined configuration dictionary.
Final full suite rerun after all code/SQL changes passes. Expected sanitized API error
logs come from deliberately failing service mocks, not infrastructure failures.

Persistence, multi-feature rollback, notice deduplication, serial concurrency and
permission queries are MOCKED. Migration tests inspect forward SQL, not PostgreSQL
constraints or trigger execution. UI tests render initial SSR shells only, not
authenticated desktop/mobile browser acceptance. Upstash and PostgreSQL live tests
were skipped. No live payment/refund/receipt/recovery/alert service was contacted.

## Local preview and boundaries

Started with:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3015'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase9'}}); process.exit(r.status??1)"
```

http://127.0.0.1:3015/admin/operations (protected; login redirect expected).
Anonymous GET operations overview, forged-role/student access, audit, admin commerce
and student commerce return 401. Anonymous POST pilotGrant returns 401.
/admin/operations, /admin/commerce, /packages redirect 307. /api/live returns 200
(process-only liveness). Fetch redirects were manual. No authenticated mutation,
signup/login, DB-health, auth/provider or migration endpoint was exercised.
Earlier previews were left intact.

## Disabled/partial and remaining release risks

- Free invited pilot scope only. Paid browser checkout, provider activation, live
  webhooks/refunds/receipt acceptance, tax invoicing and subscriptions remain future
  approved work. Existing mocked payment foundation is not a live paid-launch sign-off.
- No approved catalogue was invented or populated. Actual licensed reviewed learning
  content and blueprint publication must be supplied by authorized operators later.
- Invited package grants are existing-account operator actions, not a delivered email
  invitation/onboarding token. Existing role and account-consent safeguards remain.
  They do not override guardian authorization or make blocked authentication usable.
- Form UUIDs survive same-tab retries only. Inspect grant/audit history after a full
  reload before another submission. Access administration is per feature, not a bulk
  bundle revocation; overlapping valid grants can continue access.
- Administration pages are bounded (existing catalogue/history/support lists 100;
  new paginated grant/audit views 25 per page, max 1,000 pages). No scheduled queue
  worker, automatic paging alert, support assignment or permanent alert history added.
- No monitor, backup schedule, archive, encryption service, restore, CI infrastructure,
  Railway release or datasource cutover was provisioned/executed. pg_dump/pg_restore/
  psql were not found on PATH; portable locations were not used or installed.
- Runbook recovery/retention/RPO/RTO are proposals requiring operator/privacy approval,
  not achieved results. Target identity, isolated write workloads, archived session
  handling and actual backup/alert/restore drills remain explicit external gates.
- Local/process auth activation, live limiter verification, trusted-ingress, account
  policy, guardian verification and recovery delivery flags checked disabled without
  showing values/secrets. Payment/knowledge factories remain null; no production
  signup/login, payment, AI or external messaging activation. Deployed settings unknown.
- Real PostgreSQL migration/concurrency/rollback, authenticated browser and recovery
  acceptance, guardian/legal approval, reviewed content and named support operations
  remain mandatory. Railway trusted ingress and live Upstash remain unresolved.
- Existing historical grant/order anomalies must be reviewed, not silently rewritten
  or accepted as paid. Protected answers/scoring, historical attempts, consent and
  tenant privacy were not widened.

Single next recommended task: controlled end-to-end release verification against an
explicitly approved isolated PostgreSQL target, then authenticated staging acceptance
and operator content/readiness review. This report does NOT authorize those writes.

## Git preservation and proposed commit/push (NOT EXECUTED)

Branch main. Start 206 expanded dirty paths (78 tracked, 128 untracked).
End 226 expanded dirty paths (85 tracked, 141 untracked), including this report.
Original 15 staged paths retained; no staging, reset/stash, branch change or commit/push.
No database/provider, dependency installation, publication, seed/import, migration,
deployment or system configuration change occurred. Local app preview only.

Phase 9 depends on existing uncommitted Phases 1-8. Review all earlier dependencies
and the already-staged paths; do not commit an incomplete Phase 9-only snapshot.
The scoped list stages whole files, including any prior edits in shared files.
Do not git add . or stage environment secrets/local target files. Stage earlier phase
dependencies from their reviewed reports before approving the complete commit.

```powershell
git status --short
git add -- src/server/commerce/validation.ts src/server/commerce/service.ts src/server/commerce/access.ts src/server/operations/launch.ts src/shared/entitlement-state.ts src/server/notifications/service.ts src/components/commerce/CommerceWorkspace.tsx src/components/commerce/LaunchOperations.tsx src/app/admin/page.tsx src/app/admin/operations/page.tsx src/app/api/admin/operations/route.ts prisma/migrations/20261013000100_free_pilot_packages/migration.sql tests/commerce/provider.test.ts tests/commerce/service.test.ts tests/commerce/pilot.test.ts tests/commerce/operations.test.ts tests/commerce/operations-routes.test.ts tests/commerce/pilot-migration.test.ts tests/commerce/operations-ui.test.tsx next.config.ts next-env.d.ts tsconfig.json LAUNCH_OPERATIONS_RUNBOOK.md COMMERCE_OPERATIONAL_COMPLETION_PHASE9.md MASTER_BUILD_STATUS.md CONTROLLED_VERIFICATION_REPORT.md
git diff --cached --stat
git diff --cached
git commit -m "Implement free-pilot commerce and launch operations"
git push origin main
```

Run commit/push only after the whole intended snapshot/dependencies are reviewed.
Neither command nor the staging command was run by the agent.

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
?? COMMERCE_OPERATIONAL_COMPLETION_PHASE9.md
```
