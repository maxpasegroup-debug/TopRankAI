# Phase 6: Timed mock exams

Assessment date: 2026-10-11 (Asia/Calcutta). Code increment delivered; production
exit NOT accepted until live database/browser/content prerequisites are satisfied.
Original TIMED_MOCK_EXAMS.md and previous verification evidence preserved.

## Delivered behavior

- Reused canonical mocks, attempts, saved answers, protected frozen snapshots,
  decimal scoring, entitlement checks, ownership, transaction retries and audit.
- Administrator draft authoring/inspection, structural validation, independent
  review with evidence, publication and unpublication. Server records reviewer
  identity; clients cannot set it. Review is bound to saved version/fingerprint.
  Draft edits invalidate approval. Unchanged publication lifecycle preserves review.
  A second authorized platform administrator is required to review an author's work.
- New starts require current blueprint review. Existing active/replayed attempts
  resume with their original snapshot. Reserved competition blueprints retain their
  mutation restriction; cancel before editing/reviewing. No exam was published.
- Autosave after 750ms inactivity, bounded 10-second retry backoff, explicit save,
  and save-before-navigation/submission. Definitive validation/version conflicts
  pause autosave. Save acknowledgments alone clear uncertain local work.
- Owner/attempt-scoped sessionStorage preserves one pending answer, original CAS
  version, flag and bookmark across reload. Strict parsing accepts only bounded
  drafts up to 24 hours old. Lost acknowledgments reconcile against server answers.
  Stale-version conflicts show saved/local answers and require explicit resolution.
- Online/pageshow/visible reconciliation and server-anchored timer display using
  monotonic plus wall elapsed time. Display expiry triggers a server GET, not a
  premature manual submit. Server deadline remains authoritative.
- Expired reads/saves finalize persisted answers only. Duplicate starts/save
  replays/finalization retain existing idempotency and CAS/serializable protections.
- Finalized per-question results and escaped explanations follow the frozen
  AFTER_SUBMISSION policy. Active and NEVER-policy responses have no review array
  entries. No protected numerical answer or option correctness key is added.
- Existing incorrect/unanswered/flagged/bookmarked revision queue, lesson links,
  reviewed markers, capacity-aware mission handoff and progress remain connected.

## Important files

- src/server/mock/service.ts: independent review, safe attempt DTO review and owned
  directory identity. Prior capacity-aware mission work preserved.
- src/server/mock/validation.ts: strict authenticated review action/evidence.
- src/components/mock/AdminMocks.tsx: inspection, evidence and reviewed-state actions.
- src/components/mock/StudentMocks.tsx: autosave, recovery, timer/reconnect and results.
- src/shared/mock-recovery.ts: strict draft storage, comparison and timer helpers.
- src/app/practice/mock-attempts/page.tsx: attempt-keyed state and practice navigation.
- tests/mock/{service,routes,recovery,ui}.test.*: 29 added regression tests.
- next.config.ts: isolated Phase 6 build/preview directory. Next updated generated
  next-env.d.ts to Phase 6 and added tsconfig references, retaining prior includes.
- MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md: current evidence.

No Phase 6 schema change/migration. Existing editorial records from earlier pending
migrations are required. No migration, database connection, seed or import executed.

## Actual verification

Commands executed with existing dependencies; no installation:

```powershell
npx.cmd vitest run tests/mock tests/competition tests/commerce tests/question tests/student
npm.cmd test
npm.cmd run typecheck
npx.cmd prisma validate --config prisma7.config.ts
npx.cmd prisma generate --config prisma7.config.ts
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase6'}}); process.exit(r.status??1)"
git diff --check
```

- Focused final run: 611 passed, 33 files.
- Full final run: 1,305 passed, 2 gated tests skipped; 65 files passed, 2 skipped.
  Compared with Phase 5's 1,276 passing tests: 29 new passing tests.
- TypeScript, Prisma validation/client generation: PASS (offline, no DB execution).
- Optimized production build: PASS, 62 static-generation entries.
- Whitespace: PASS; existing LF/CRLF warnings and inaccessible global Git ignore
  warning were observed without changing configuration.
- Initial regression fixtures omitted the new editorial model (12 failures); updated
  mocked fixtures and added negative review tests. A duplicate DTO property failed
  an intermediate typecheck and was removed. Final reruns passed.

Persistence, unique-start races, save CAS and duplicate finalization tests use mocked
database behavior, not real PostgreSQL locks/transactions. Recovery/timer tests are
pure helper tests; UI tests render initial SSR shells, not interactive browsers.
The two existing gated live tests remained skipped. No provider or database target
was contacted. No authenticated browser acceptance is claimed.

Loopback preview started using the isolated build:

```powershell
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3012'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase6'}}); process.exit(r.status??1)"
```

Anonymous HTTP probes: GET /api/student/mocks, /api/student/mocks/revision,
/api/admin/mocks and POST /api/student/mocks returned 401. GET /practice/mock-tests,
/practice/mock-attempts?attemptId=invalid and /admin/mock-exams returned 307.
No login/signup route, health/DB route or authenticated mutation was invoked.
Preview: http://127.0.0.1:3012/practice/mock-tests (protected; login redirect expected).
Earlier preview servers were not stopped or replaced.

## Limitations and launch gates

1. Explicitly approve isolated PostgreSQL identity and all writes before verifying
   pending migrations, persistence and cross-process concurrency. No such approval
   or connection occurred in this increment.
2. Authenticated desktop/mobile acceptance remains pending: autosave, reload,
   disconnect, lost acknowledgment, multiple tabs, suspend, expiry, manual submit
   and result/revision handoff against that disposable DB.
3. Supply licensed, independently reviewed exam questions/explanations and blueprints.
   Existing published legacy mocks without matching editorial records now reject
   fresh starts. Save a draft to establish authorship, independent-review and publish;
   do not manufacture/backfill approval. Existing frozen attempts remain accessible.
   Legacy question review/provenance flags still need the Phase 5 launch audit.
4. This is not full offline exam-taking: one pending question per tab; navigation
   waits for server save. Unsent answers after deadline are not accepted. Session
   recovery depends on available browser storage and does not synchronize devices.
   Plain browser storage is not encrypted; 24-hour eligibility is not background
   deletion. No answer keys are stored there; student answers themselves are personal.
5. Expiry is reconciled on reads, saves, submissions and directory/competition reads;
   no background worker guarantees immediate finalization while everyone is offline.
   Server/DB time and deployment timezone operational checks remain required.
6. Existing bounded views: 100 mocks, latest 50 attempts, 200 selectable questions,
   revision from latest 20 finalized attempts. Full pagination/search and delegated
   reviewer roles/assignment/change-request workflow are not added here.
7. No official JEE/NEET timing/marking equivalence is asserted; authorized content
   reviewers must verify each configured blueprint. No official content invented.
8. Local/process authentication activation, live verification, trusted-ingress and
   consent/recovery approval gates were checked disabled without secret output.
   Production signup/login therefore remain fail-closed under existing guard rules.
   Commerce provider factory remains null. Deployed environment not inspected;
   Railway trusted-ingress/live verification remain unresolved prerequisites.

## Git and preservation

Branch main. Existing 15 staged paths preserved; no git add, commit, push, reset,
stash, branch change, deploy, install, content publication, DB/migration/seed/import
or production activation performed. All prior modified/untracked work retained.
Final expanded Git inventory follows below. Do not commit this increment alone
without reviewing its earlier uncommitted editorial/account/practice prerequisites.

Proposed commands only; the index already contains earlier work. Review it first.
Do not use git add . because the tree contains unrelated pending work.

```powershell
git status --short --untracked-files=all
git diff --cached --stat
git add -- src/server/mock/service.ts src/server/mock/validation.ts src/components/mock/AdminMocks.tsx src/components/mock/StudentMocks.tsx src/shared/mock-recovery.ts src/app/practice/mock-attempts/page.tsx tests/mock/service.test.ts tests/mock/routes.test.ts tests/mock/recovery.test.ts tests/mock/ui.test.tsx next.config.ts next-env.d.ts tsconfig.json TIMED_MOCK_EXAMS_PHASE6.md MASTER_BUILD_STATUS.md CONTROLLED_VERIFICATION_REPORT.md
git diff --cached --check
git diff --cached --stat
git commit -m "Harden timed mock review, autosave and recovery"
git push origin main
```

Next recommended task: guarded disposable-database verification and authenticated
mock acceptance, with target identity/write approval, before launch sign-off.

## Final Git inventory

177 paths: 67 tracked dirty paths and 110 untracked files; 15 staged paths unchanged.
`AM` / `MM` entries include both previous staged and subsequent working-tree work.

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
 M src/app/practice/mock-attempts/page.tsx
 M src/app/practice/revision/page.tsx
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/MissionBoard.tsx
 M src/components/journey/OperationsWorkspace.tsx
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
?? src/server/journey/schedule.ts
?? src/server/practice/revision.ts
?? src/server/question/authoring.ts
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/lesson-content.ts
?? src/shared/mock-recovery.ts
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
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
```
