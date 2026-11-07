# Accounts, Consent and Privacy: completion evidence

Date: 2026-10-22 (Asia/Calcutta). Branch: main. Step 3 exit: NOT MET.
Status: coherent implementation increment complete; live acceptance and operating
approvals remain BLOCKED. This is not a launch or compliance certificate.

## 1. Completed implementation

- Reused existing student-only signup, bcrypt passwords, database sessions,
  same-origin mutation checks, bounded JSON, sanitized errors and rate-limit gates.
  Public parent/staff registration was NOT enabled.
- Extended current policy acceptance to existing staff-provisioned PARENT accounts.
  Parents must have a current adult receipt; students retain age/country/guardian
  selection. Staff session behavior is unchanged. Consent-only sessions may manage
  account rights, not ordinary learning/portal access.
- Guardian grant issuance/claim and subsequent minor access now require the active
  PARENT guardian's own current adult consent. Authorization remains recorded by
  approved platform staff, with identity/authority and consent attestations and an
  evidence reference. These are manual operating steps, not an invented identity service.
- Student withdrawal atomically revokes consent, sessions, unused recovery links,
  public achievement hashes, ranking visibility and pending/active parent/school
  sharing. Guardian withdrawal also revokes associated student access and guardian
  grants, plus that parent's optional sharing relationships. Serializable bounded
  retry transactions use the existing canonical helper. No historical attempts erased.
- Sharing reads fail closed on missing/stale/revoked account or guardian consent:
  achievement links, leaderboards, parent directories, school rosters and exports.
  Enabling public sharing requires current authorization inside the transaction.
  Disabling sharing remains possible at service level without restoring consent.
- Guardian revocation is owner-bound and invalidates used student authorization.
  Adulthood verification requires the existing approved staff process and renewed
  student acceptance; a student cannot remove safeguards by self-asserting adulthood.
- Existing recovery now covers active STUDENT/PARENT accounts only. Generic responses,
  encrypted delivery payloads, hashed one-use tokens, password hashing and session
  revocation are preserved. Staff recovery was not added.
- Added an admin-only bounded cleanup action for up to 100 expired/consumed recovery
  payloads per invocation. It clears ciphertext/leases only, not account records.
  No cleanup executed, provider called or scheduler configured in this increment.

## 2. Private support and privacy requests

- Student/guardian route: /account/privacy-requests; admin: /admin/privacy-requests.
  APIs: /api/account/privacy-requests (GET/POST/PATCH) and
  /api/admin/privacy-requests (GET/PATCH). Linked from consent, settings and operations.
- Request kinds: ACCESS, CORRECT, DELETE, ACCOUNT_SUPPORT. All begin OPEN on server.
  A requester may see only their own cases. Cross-student requests require an actual
  current used guardian registration grant; a role or progress-sharing grant alone
  is not legal authority. Authority is rechecked on follow-up.
- UUID creation keys reject changed-intent replay. Maximum five open cases, bounded
  pagination, strict field allowlists and 4 KiB request bodies. No client-selected
  owner/reviewer/status. Admin and subject authority are checked in the service too.
- Review transitions: OPEN -> IN_REVIEW/AWAITING_USER/REJECTED;
  IN_REVIEW -> AWAITING_USER/RESOLVED/REJECTED;
  AWAITING_USER -> IN_REVIEW/RESOLVED/REJECTED. Terminal records cannot be reopened.
- Versioned compare-and-set decisions reject stale updates; identical acknowledged
  decisions replay read-only. Closing requires a reviewer, meaningful response,
  restricted evidence reference and explicit manual processing attestation.
- Privacy closure additionally requires BOTH ACCOUNT_POLICY_REVIEWED=true and
  ACCOUNT_PRIVACY_PROCESSING_APPROVED=true. Templates default the latter to false.
  Account-support review/closure is independent of the privacy-processing gate.
  Do not set either approval merely to make the UI succeed.
- Follow-ups preserve original request intent, use version/UUID checks and a bounded
  five-per-minute per-actor audit count. Only the latest follow-up is stored, not a
  full correspondence thread. Cases/audits are not an external notification service.
- Sensitive internal evidence references are not returned by user/queue projections.
  Request text is private and React-escaped; users are warned not to include identity
  documents, passwords or tokens. Audits contain minimal event metadata, not case text.
- Client freezes pending creation/follow-up payloads across uncertain retries in the
  current page session. Reload loses that local pending key; accepted cases remain
  in the private list. Local discard never cancels an accepted server request.
- Submitting DELETE does NOT delete an account. No export, correction, anonymization
  or erasure executor was fabricated. Manual processing must occur before closure.

## 3. Policy identity and rollout

The user supplied TOP RANK AI PRIVATE LIMITED. This exact name appears on the draft
Terms/Privacy Notice; corporate registration has NOT been independently verified.
Registered address, support email, privacy/grievance contact, approved retention
schedule and qualified legal-review reference were not supplied. No placeholders
were represented as real contacts. India/UAE remain scoped markets, not proof of
jurisdictional legal approval. No arbitrary adults-only launch was introduced.

ACCOUNT_POLICY_VERSION is 2026-10-22-draft. Deploying this change invalidates older
receipts for normal account access and sharing. Plan renewal communications and
verified guardian renewal before activation; do not silently copy old acceptance.
Legacy parent accounts with an inconsistent minor receipt need verified staff
remediation, not a hidden self-service age upgrade. Qualified counsel must approve
the actual age/country/guardian, account-rights and policy workflows before release.

## 4. Retention and account-rights operating procedure (NOT YET APPROVED)

1. Assign named privacy/support operators and publish verified contact details.
   Establish a safe intake/escalation alternative for users unable to authenticate.
2. Verify requester identity and, where applicable, guardian authority using the
   approved restricted evidence channel. Do not collect identity documents in cases.
   Separate guardian legal authority from optional progress-sharing consent.
3. Inventory relevant records: account/profile/consent, sessions/recovery, learning
   attempts/progress, sharing, support cases/audits, external processors and backups.
4. Approve a retention matrix per record/purpose/jurisdiction, including trigger,
   justified duration, disposal method, legal hold, responsible owner and backup
   expiry. All business/legal retention durations remain TBD, not invented here.
   Session/reset/grant security expiry constants are NOT legal retention schedules.
5. Assess holds and third-party rights; authorize a scoped export/correction/erasure
   or documented lawful exception. Use a reviewed dry run, least-privileged bounded
   executor, approval and recovery plan. Such an executor is still pending.
6. Verify outcome independently, including active sharing and processor handling.
   Establish a restricted backup-restore suppression ledger/procedure so restored
   data does not accidentally reactivate withdrawn access or completed erasures.
7. Deliver data/responses over an identity-verified channel, never a public link or
   unverified email. Record a restricted evidence reference, then close the case.
8. Schedule reviewed retention processing, monitor failures, and rehearse restoration
   and overdue-case escalation. None was scheduled or run in this increment.

This defines the required procedure; it is not evidence that retention/erasure,
identity verification, secure export delivery or staff coverage is operational.

## 5. Schema and migration state

Added AccountPrivacyRequest and named User requester/subject/reviewer relations.
New forward-only migration: prisma/migrations/20261022000100_account_privacy_requests/migration.sql.
Includes foreign keys, unique requester/request key, queue indexes, kind/status,
message/version and non-NULL terminal processing evidence constraints. UNAPPLIED.
ORM client generated offline. No historical migration changed in this increment.

Migration manifest now has 21 entries; its test explicitly checks the new entry.
Earlier infrastructure replay completed 16 migrations, then failed P3018/42P07 at
20261011000100_daily_study_command_centre: duplicate StudyPlan_one_active_per_user
from the student-journey migration. Three later pre-existing migrations and this
new migration remain unapplied on that test cluster. No repair/reset/resolution
performed here. New account routes require the schema migration before real use.

## 6. Actual verification

All persistence/provider behavior below is mocked unless explicitly stated.
No PostgreSQL, Redis/Upstash, Railway or mail-provider connection in this increment.

| Command | Result |
| --- | --- |
| node node_modules/vitest/vitest.mjs run tests/auth tests/competition tests/portal | PASS: 695 passed, one live Upstash test skipped |
| Full offline suite, wrapper below | PASS: 1,661 passed, two gated live tests skipped; 83 test files passed |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | PASS |
| node node_modules/typescript/bin/tsc -p verification/tsconfig.json --noEmit --incremental false | PASS |
| Offline Prisma validate --config prisma7.config.ts, wrapper below | PASS |
| Offline Prisma generate --config prisma7.config.ts, wrapper below | PASS: Prisma Client 7.10.0 |
| Isolated next build, wrapper below | PASS: optimized Next 16.3.5 build, 66 generation entries |
| git diff --check | PASS; normal LF/CRLF warnings, no whitespace errors |

New coverage includes strict case validation, ownership, guardian authority,
idempotency, stale/concurrent decisions, closure evidence/gates, follow-up limits,
withdrawal sharing effects, parent consent/session checks, recovery cleanup,
HTTP origin/roles/body bounds/error sanitization/cookie clearing, initial UI/policy
rendering and migration constraints. Existing auth/portal/competition tests pass.
The first full run found a stale expected migration count (20 versus 21), corrected
with an explicit new-migration assertion, then rerun green. No check weakened.

Exact safe PowerShell commands used (inert URL is not a real target):

```powershell
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}});process.exit(r.status??1)"
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','validate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}});process.exit(r.status??1)"
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','generate','--config','prisma7.config.ts'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}});process.exit(r.status??1)"
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation',TOPRANK_VERIFY_BUILD:'accounts',NEXT_TELEMETRY_DISABLED:'1',AUTH_RATE_LIMIT_ACTIVATED:'false',AUTH_TRUSTED_PROXY_VERIFIED:'false',ACCOUNT_POLICY_REVIEWED:'false',ACCOUNT_GUARDIAN_VERIFICATION_APPROVED:'false',ACCOUNT_PRIVACY_PROCESSING_APPROVED:'false',AUTH_RECOVERY_DELIVERY_VERIFIED:'false',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false'}});process.exit(r.status??1)"
```

Build output is isolated under .next/accounts-verification. Next regenerated its
route typing import and added this output's type globs to tsconfig.json; prior
infrastructure settings/globs were retained. No dependency/lockfile install.
Initial static-render tests are NOT interactive browser/mobile acceptance.
Real transaction races, raw leaderboard SQL, migrations and database persistence
remain untested in this increment. Build success is not a DB smoke test.

## 7. Live-service and release gates

Presence-only inspection of .env/process found missing or empty:
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, AUTH_RATE_LIMIT_TEST_TARGET,
AUTH_RATE_LIMIT_TEST_ENDPOINT_SHA256 and RUN_UPSTASH_LIVE_TESTS. No values or
fingerprints printed. No target can be positively confirmed, so live test NOT RUN.
Use AUTHENTICATION_HARDENING.md's dedicated Free sandbox checks before any live call.
Do not infer plan, ownership or isolation from a URL/hash alone.

Railway trusted-ingress overwrite/strip and direct-origin bypass behavior remain
UNVERIFIED. No activation flag set. Existing missing-provider/ingress gates keep
production signup/login fail-closed; live recovery delivery likewise unapproved.
This describes local code/configuration, NOT an inspected deployed Railway state.
Payments and advanced AI remain outside scope and were not activated.

Remaining release blockers: migration repair/replay and real account lifecycle
acceptance; actual guardian identity/authority SOP/staff coverage; policy contacts,
retention/rights executor and legal review; verified mail delivery; dedicated live
Upstash and trusted-ingress evidence; secure staging/browser accessibility/mobile
acceptance; remote auto-deploy status still unverified. Push remains ON HOLD.

## 8. Important files and preservation

- src/server/auth/{account-consent,session,recovery,sharing,privacy-requests}.ts:
  canonical authorization, withdrawal, recovery and private cases.
- src/server/competition/{service,achievements}.ts and src/server/portal/
  {authorization,service}.ts: current-consent sharing enforcement.
- src/app/account/{consent,privacy-requests}, src/app/admin/privacy-requests,
  src/app/api/account/{consent,privacy-requests}, src/app/api/admin/
  {accounts,privacy-requests}: real authorized routes.
- src/components/account/{AccountConsent,GuardianConsent,AdminAccounts,PrivacyRequests}.tsx
  and src/screens/Settings.tsx: existing-design workflow and navigation.
- src/shared/account-policy.ts; src/app/{terms,privacy}/page.tsx: supplied company,
  draft policy version and honest missing prerequisites.
- prisma/schema.prisma, the new migration, auth/competition tests and migration
  manifest test; environment example approval flag; isolated build configuration.
- This report, MASTER_BUILD_STATUS.md, RELEASE_SCOPE_CHECKLIST.md and
  AUTHENTICATION_HARDENING.md: current evidence without claiming acceptance.

All 11 modified and 12 untracked paths present at the start were preserved. Some
shared files gained directly related additions (environment examples, build types,
master/scope status and manifest test); no prior infrastructure work was reverted.
CONTROLLED_VERIFICATION_REPORT.md remains unchanged historical evidence.
No commit, stage, push, deploy, production activation, DB connection, migration,
seed, import, package install or data deletion was performed in this increment.
Final path inventory is in the Git-status section below.

## 9. Single next recommended task

Resolve the duplicate-index migration compatibility safely in a separate guarded
increment, then replay the complete 21-migration chain on an explicitly approved
fresh disposable target. Never conceal the failure by editing applied history or
resetting the existing partial cluster. Only after that should real account,
guardian, withdrawal and private-case persistence acceptance begin.

## 10. Final Git inventory

Branch main; 34 modified tracked paths, 24 untracked files, nothing staged.
This includes the preserved earlier scope/infrastructure work, not just Step 3.
Git warns that the user's global ignore file cannot be read in the sandbox;
repository status works. LF/CRLF warnings do not indicate whitespace check failure.

```text
 M AUTHENTICATION_HARDENING.md
 M LAUNCH_PROGRAMME_PHASE1_REFRESH.md
 M MASTER_BUILD_STATUS.md
 M config/environments/development.env.example
 M config/environments/production.env.example
 M config/environments/staging.env.example
 M next-env.d.ts
 M next.config.ts
 M package.json
 M prisma/schema.prisma
 M src/app/account/consent/page.tsx
 M src/app/api/account/consent/route.ts
 M src/app/api/admin/accounts/route.ts
 M src/app/privacy/page.tsx
 M src/app/terms/page.tsx
 M src/components/account/AccountConsent.tsx
 M src/components/account/AdminAccounts.tsx
 M src/components/account/GuardianConsent.tsx
 M src/screens/Settings.tsx
 M src/server/auth/account-consent.ts
 M src/server/auth/recovery.ts
 M src/server/auth/session.ts
 M src/server/competition/achievements.ts
 M src/server/competition/service.ts
 M src/server/portal/authorization.ts
 M src/server/portal/service.ts
 M src/shared/account-policy.ts
 M tests/auth/account-consent.test.ts
 M tests/auth/account-sessions.test.ts
 M tests/auth/recovery.test.ts
 M tests/competition/service.test.ts
 M tests/foundation/postgres-target.test.ts
 M tsconfig.json
 M verification/postgres-target.ts
?? .github/workflows/ci.yml
?? ACCOUNTS_CONSENT_PRIVACY_COMPLETION.md
?? RELEASE_SCOPE_CHECKLIST.md
?? SAFE_DEVELOPMENT_INFRASTRUCTURE.md
?? config/environments/README.md
?? prisma/migrations/20261022000100_account_privacy_requests/migration.sql
?? src/app/account/privacy-requests/page.tsx
?? src/app/admin/privacy-requests/page.tsx
?? src/app/api/account/privacy-requests/route.ts
?? src/app/api/admin/privacy-requests/route.ts
?? src/components/account/PrivacyRequests.tsx
?? src/server/auth/privacy-requests.ts
?? src/server/auth/sharing.ts
?? tests/auth/privacy-requests.test.ts
?? tests/auth/privacy-routes.test.ts
?? tests/auth/privacy-ui.test.ts
?? tests/foundation/postgres-workflow.test.ts
?? verification/finalize-postgres.ts
?? verification/postgres-workflow.ts
?? verification/prisma.config.ts
?? verification/run-postgres.ts
?? verification/setup-postgres.ts
?? verification/stop-postgres.ts
?? verification/tsconfig.json
```

## 11. Optional commit/push commands (NOT EXECUTED)

These paths cover the combined pending scope/infrastructure/account work above.
Review staged changes before committing; do not stage a private .env or target
identity file. Migration application is not authorized by a commit. PUSH ON HOLD:
Railway production auto-deploy has not been verified disabled. Only run the final
commented command after that is verified and push is explicitly approved.

```powershell
git add -- src tests prisma/schema.prisma prisma/migrations/20261022000100_account_privacy_requests verification .github/workflows/ci.yml config/environments package.json next.config.ts next-env.d.ts tsconfig.json AUTHENTICATION_HARDENING.md MASTER_BUILD_STATUS.md LAUNCH_PROGRAMME_PHASE1_REFRESH.md RELEASE_SCOPE_CHECKLIST.md SAFE_DEVELOPMENT_INFRASTRUCTURE.md ACCOUNTS_CONSENT_PRIVACY_COMPLETION.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Prepare safe verification infrastructure and account privacy safeguards"
# HOLD until deployment safety and push approval:
# git push origin main
```
