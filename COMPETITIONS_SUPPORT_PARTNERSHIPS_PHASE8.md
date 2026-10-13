# Phase 8: Competitions, support and partnerships

Date: 2026-10-11 (Asia/Calcutta).
Coherent pilot-scope code increment delivered; production exit NOT accepted.

## Scope and delivered features

Launch scope remains JEE Main + NEET UG, India/UAE, free invited pilot.
School/teacher expansion is not included in this pilot; existing tenant workflows
were retained and regression-tested, not expanded or declared production-ready.

- Canonical challenges retain dedicated frozen mocks, server scoring, bounded
  serializable retries, eligibility/capacity, owner-bound join replay, moderation,
  opt-in aliases, withheld protected answers and manual prize review.
- Challenge publication additionally requires the independent blueprint review
  implemented in Phase 6. No content or competition was published during this work.
- Results now distinguish PROVISIONAL, VERIFIED and CANCELLED. Verification means
  settlement of persisted server-finalized attempts under saved ranking rules,
  NOT identity/proctoring verification, an official exam rank or cheating detection.
- Closing/recalculating verifies only after the entry window and all active attempts
  finish/expire. Completed-result refresh by a student is read-only: it cannot stamp
  historical results verified. Administrator correction/moderation remains audited.
- Overall rankings and placement eligibility require completed verified results.
  Historical completed rows deliberately remain unverified until admin recalculation.
  Public legacy placement links fail closed until current verified evidence qualifies.
- Cancellation withdraws public rankings, clears verification and sharing, and retains
  the student's private attempt history. Pending prizes are rejected; external prize
  fulfilment is not claimed. New awards produce deduplicated generic in-app notices.
- Help creation retains owned request UUID replay and rejects changed replay payloads.
  Responses use a strict nonnegative version plus compare-and-swap update. A stale
  operator cannot overwrite another response. Identical lost-ack retries do not write
  or generate another notice. Replies, minimal audit and notice share one transaction.
- Admin queue prioritizes OPEN then IN_PROGRESS then RESOLVED with stable ordering
  and a 100-record bound. Explicit reload confirms discarding unsaved response edits.
  Student request refresh is independent of deterministic SIA availability.
- Private student inbox reuses CommerceNotification (not a second notification model).
  Supports 25-item pagination with a sentinel, unread filtering/count, refresh/retry,
  owner-only mark-read and timestamp-bounded mark-all. First read timestamps survive
  repeats. Fixed internal destinations; no event keys/provider details in the DTO.
- Support, achievement and competition notices contain generic text only. They use
  IN_APP/AVAILABLE and never enqueue email/WhatsApp or call external delivery.
- Guardian-sharing decisions notify both parties. Portal displays expiry and distinct
  student consent/guardian acceptance. Existing independently verified proposal,
  dual acceptance, fresh actor, strict scopes, narrowing, revocation, expiry and
  private support/counselling exclusions remain enforced server-side.

## Routes and important files

Student: /compete, /achievements, /get-help (support and inbox), /progress link,
/parent and /consent existing guardian controls.
Admin: /admin support queue, /admin/competitions and /admin/portals existing operators.
New API: GET/POST /api/student/notifications; student identity comes from session.
Existing API: /api/student/help, /api/admin/help, /api/student/competitions,
/api/student/achievements, /api/admin/competitions and /api/portal.
Shared authentication/origin checks and private no-store wrappers are retained.

Changed server files: src/server/competition/{service,achievements}.ts,
src/server/mock/service.ts (exports the existing review guard),
src/server/help/service.ts, src/server/operations/service.ts,
src/server/portal/service.ts and new src/server/notifications/service.ts.
UI: CompetitionWorkspace, OperationsWorkspace, GetHelp, ProgressDashboard,
PortalWorkspace and new NotificationInbox. No unrelated user changes removed.
Tests: expanded competition/service, student/operations, portal/lifecycle; new
student/{notifications,notification-routes,engagement-migration}.test.ts and
engagement-ui.test.tsx. next.config.ts adds isolated Phase 8 build output.
Build-generated next-env.d.ts/tsconfig.json retain previous verification includes.
MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md append current evidence.

## Schema and migration: NOT APPLIED

prisma/migrations/20261011000300_engagement_support/migration.sql:
HelpRequest.version default 0; nullable Competition.resultsVerifiedAt; existing
CommerceNotification owner/channel/status/createdAt index.
No backfill fabricates verification. No historical migrations changed.
All earlier unapplied migrations remain dependencies. No migration/seed/import ran.

## Actual verification

Exact commands executed:

```powershell
npx.cmd vitest run tests/competition tests/student tests/portal tests/mock
npm.cmd test
npm.cmd run typecheck
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','validate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','generate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}}); process.exit(r.status??1)"
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase8'}}); process.exit(r.status??1)"
git diff --check
```

Final focused: 729 passed (33 files). Full: 1,461 passed/2 gated tests skipped
(74 files passed/2 skipped): 77 additions over Phase 7's 1,384.
TypeScript and offline Prisma validation/generation PASS.
Isolated optimized Next build PASS (63 static-generation entries).
Whitespace check PASS; baseline LF/CRLF/global-ignore permission warnings remain.
Intermediate TypeScript failure from a support test missing the new required version
was fixed in its fixture; final checks pass. Sanitized Unhandled API error logs are
deliberate error-response tests, not live infrastructure failures.

All persistence, notification deduplication, CAS and concurrency assertions are
MOCKED. Migration tests inspect SQL contracts, not PostgreSQL execution. UI tests
render initial SSR shells, not authenticated browser interactions.
Upstash live and gated PostgreSQL identity tests were skipped. No database connected.

Loopback preview started with:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3014'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase8'}}); process.exit(r.status??1)"
```

http://127.0.0.1:3014/get-help (protected; login redirect expected).
Anonymous GET inbox (including forged identity), help, competitions, admin help,
portal workspace and POST inbox mark-all return 401. /get-help, /compete,
/achievements, /parent and /consent return 307. Fetch used manual redirects.
No authenticated request, signup/login, health/DB endpoint or external call ran.
Earlier local previews were preserved.

## Disabled features and release gates

- No database connection, migration, seed/import, dependency installation, external
  provider, content publication, commit/push, deployment or activation occurred.
- Local/process authentication activation, live rate-limit verification, trusted
  proxy verification, account-policy review, guardian-verification approval and
  recovery-delivery verification flags checked disabled WITHOUT printing values.
  Payment provider and knowledge adapter factories remain null. External delivery
  receives no new outbox work. Deployed configuration was not inspected.
- Production signup/login remain gated, live payments/AI/messaging disabled.
  Railway trusted ingress and real Upstash verification are still unresolved.
- Approved isolated PostgreSQL migration/persistence/CAS/concurrency/rollback tests,
  authenticated desktop/mobile/reconnect acceptance and real operator workflows
  remain required before accepting the exit criterion.
- Actual licensed independently reviewed launch lessons/questions/mocks still must
  be supplied. No artificial reviewed content, achievements or accounts were seeded.
- Registration guardian authorization is separate from optional progress sharing.
  Country-specific legal/policy and actual external guardian verification procedures
  must be approved before enabling affected registration. This increment is not
  India/UAE legal sign-off and does not add arbitrary adults-only access.
- Human support staffing, response ownership/SLA, escalation, safeguarding and
  moderation procedures remain operator prerequisites; this is not live counselling,
  a crisis service or functioning TeachX bookings.
- Ranking settlements/notifications are synchronous and bounded to <=1,000 entries;
  no background scheduler or large-scale notification worker was fabricated.
  Admin queue is bounded to 100, inbox to 100 pages. No automatic refresh/push.
- Help uncertain-submit UUID is same-tab state, not durable across full reload.
  Student aliases/public award links require deliberate sharing; rankings are not
  official percentiles. Existing frozen scoring/disclosure policy remains authoritative.
- Awards based on lesson completion/study sessions retain self-reported labels.
  Prizes need actual manual review/fulfilment; no external fulfilment integration.

Single next recommended task: finish the free-pilot package/entitlement and launch
operations scope while preserving payment/auth gates, before final guarded acceptance.

## Git preservation and proposed commands (NOT EXECUTED)

Current branch main. Start: 191 expanded dirty paths (72 tracked, 119 untracked).
End: 206 expanded dirty paths (78 tracked, 128 untracked), including this report.
Original 15 staged paths unchanged; no git add/stash/reset/branch operation ran.
This report's inventory is captured below; writing the report itself adds its new path.

Phase 8 depends on accumulated uncommitted Phases 1-7. Do not make a standalone
Phase 8 commit that omits its editorial, account, progress or portal dependencies.
The proposed staging list stages whole files, including existing edits in shared
files. Review those and the 15 already-staged paths before committing; do not use
git add . or accidentally include local credentials/test target configuration.
Reconcile/stage prior phase dependencies using their documented reviewed file lists.

```powershell
git status --short
git add -- prisma/schema.prisma prisma/migrations/20261011000300_engagement_support/migration.sql src/server/competition/service.ts src/server/competition/achievements.ts src/server/mock/service.ts src/server/help/service.ts src/server/operations/service.ts src/server/portal/service.ts src/server/notifications/service.ts src/app/api/student/notifications/route.ts src/components/competition/CompetitionWorkspace.tsx src/components/journey/GetHelp.tsx src/components/journey/NotificationInbox.tsx src/components/journey/OperationsWorkspace.tsx src/components/journey/ProgressDashboard.tsx src/components/portal/PortalWorkspace.tsx tests/competition/service.test.ts tests/student/operations.test.ts tests/portal/lifecycle.test.ts tests/student/notifications.test.ts tests/student/notification-routes.test.ts tests/student/engagement-migration.test.ts tests/student/engagement-ui.test.tsx next.config.ts next-env.d.ts tsconfig.json COMPETITIONS_SUPPORT_PARTNERSHIPS_PHASE8.md MASTER_BUILD_STATUS.md CONTROLLED_VERIFICATION_REPORT.md
git diff --cached --stat
git diff --cached
git commit -m "Complete pilot competitions, private support and guardian engagement"
git push origin main
```

Only run commit/push after reviewing the complete intended staged snapshot and
including the earlier phase dependencies. Neither command was executed here.

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
?? prisma/migrations/20261011000300_engagement_support/migration.sql
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
?? COMPETITIONS_SUPPORT_PARTNERSHIPS_PHASE8.md
```
