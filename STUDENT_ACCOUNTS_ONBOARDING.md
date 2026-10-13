# Phase 2: student accounts and onboarding

Assessment date: 2026-10-10. Implementation verified locally; release exit NOT
VERIFIED. No database connection, migration, seed, real email delivery, production
activation, dependency installation, commit, push or deployment was performed.

## Implemented account workflows

- Public signup remains STUDENT-only, including an omitted role. Explicit
  non-student roles are rejected before persistence. Country, age band and explicit
  acceptance of the current terms/privacy versions are required server-side.
- Signup validates and claims any guardian approval before creating the user.
  User, required student profile, consent receipt/audit and hashed session token
  are created within one transaction. A failed claim cannot create an account.
- The first signup step collects only country/age band. Under-18 students enter a
  verified guardian code before the UI collects name/email/password. The code
  precheck exposes no guardian or child identity; final signup checks its child
  email binding, country, policy, expiry, active guardian and single-use status.
- Guardian authorization is an explicitly reviewed PLATFORM_ADMIN operation,
  tied to an existing active PARENT account and an evidence reference. Tokens are
  returned once to the authorized operator; only their hashes are stored. Child
  email bindings use a separate keyed HMAC. This does not automate identity,
  adulthood, authority or consent verification. Approved human verification and
  staff/parent provisioning are prerequisites, not completed by a checkbox.
- Students renew or withdraw their own account consent. Parents revoke only
  their own grants. Withdrawal revokes student sessions. Student authorization
  checks current consent on each request; missing/stale receipts allow only the
  renewal workspace, not student APIs. Existing staff routing remains unchanged.
- A reviewed administrator adulthood transition removes guardian linkage,
  revokes sessions and requires fresh adult consent. Existing minor records cannot
  remove safeguards merely by changing their age assertion.
- Recovery returns a generic response for eligible and unknown accounts and
  queues an AES-256-GCM encrypted delivery payload. A bounded admin worker uses
  leases, limited retries, idempotency and a timeout for Resend delivery. Public
  requests do not call the email provider. Tokens are hashed, expire in 30 minutes,
  are single-use and require provider acceptance before redemption. A successful
  reset invalidates outstanding reset tokens and all sessions; it never logs in.
  Reset links use a fragment cleared from browser history, not a query parameter.
- New passwords enforce bcrypt's 72-byte UTF-8 limit. Existing login validation,
  hashing, session cookies, origin checks, bounded bodies and distributed limiter
  conventions are retained. New recovery endpoints use the existing login global
  budget with separate identity prefixes; guardian checks use the signup budget.
- Exam/aspiration/preferences and plan-confirmation routing reuse the existing
  journey. The wizard resumes completed profiles and existing aspirations. A
  profile-update flag cannot bypass required journey-plan confirmation.

## Policy and configuration prerequisites

The policy pages are clearly draft, not a legal compliance sign-off. India and UAE
are the only configured launch countries. Under 18 is a conservative pilot
safeguarding policy, not a statement of UAE's statutory consent age. All ages have
an authorization path; there is no adults-only restriction. An age-band assertion
is not identity/age assurance. Have counsel approve the applicable India/UAE
requirements, lawful data processing, cross-border providers, operating entity,
privacy contacts, retention/deletion and the actual verification procedure before
enabling enrollment. Other Middle Eastern countries need an explicit scope and
review. Existing portal-sharing consent is separate from registration consent.

Required dedicated settings (placeholders only; none enabled by this work):

```dotenv
ACCOUNT_POLICY_REVIEWED=false
ACCOUNT_GUARDIAN_VERIFICATION_APPROVED=false
AUTH_CONSENT_HMAC_KEY=<separate-random-key-at-least-32-characters>
AUTH_RECOVERY_DELIVERY_VERIFIED=false
AUTH_EMAIL_PROVIDER=resend
AUTH_RECOVERY_ENCRYPTION_KEY=<canonical-base64-of-a-separate-32-byte-random-key>
RESEND_API_KEY=<approved-provider-key>
AUTH_EMAIL_FROM=<verified-sender-email>
APP_URL=https://<approved-application-host>
AUTH_RATE_LIMIT_ACTIVATED=false
```

Do not turn review flags on merely to bypass validation. Reviewed versioned
policies, approved verification, verified sender/domain, delivery processing and
key management must exist first. Production rate-limiter/readiness and trusted
ingress approval are additional independent gates. Payments remain disabled.
No credentials or normal DATABASE_URL were changed or printed.

## Schema and migration

Added GuardianRegistrationGrant, AccountConsent and PasswordReset models and the
forward-only migration `20261010000600_accounts_consent_recovery`. It includes
foreign keys/check constraints and a partial unique pending-reset index.
The migration is NOT APPLIED. Historical SQL, portal migration and provider lock
are preserved. Prisma client generation/validation do not demonstrate PostgreSQL
execution, transaction rollback, row locking or concurrent single-use behavior.

Do not deploy this account increment against a schema lacking the migration.
Legacy students will need renewed consent; no invented/backfilled acceptance is
recorded. Consent withdrawal revokes access, not personal-data deletion.

## Verification evidence

Executed commands:

```powershell
node node_modules/prisma/build/index.js generate --config prisma7.config.ts
node node_modules/vitest/vitest.mjs run tests/auth tests/student tests/portal
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate --config prisma7.config.ts
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'true'}});process.exit(r.status??1)"
git diff --check
```

- Focused suite: 572 passed, 1 gated live test skipped.
- Full suite: 1,037 passed, 2 gated tests skipped (1,039 total).
- TypeScript, Prisma generation/validation and isolated Next production build:
  passed. The initial normal build failed on a pre-existing preview log lock;
  a fixed opt-in `.next/phase2-verification` output preserves that running preview.
  Next added this output's generated type paths to tsconfig.json. Its temporary
  next-env.d.ts import rewrite was restored to the original default paths.
- New consent/session/recovery tests use mocked persistence/provider transport.
  Signup tests cover both minor age bands, missing/invalid/replayed approvals,
  required versioned acceptance and all rejected privileged roles. Regression
  checks cover session revocation/current consent, reviewed adulthood transition,
  encrypted recovery tampering, expiry/single-use predicates, provider failures
  and no onboarding completion shortcut.
- Anonymous HTTP smoke: signup, login, recovery, reset, terms, privacy and guardian
  registration pages all returned 200. No account form was submitted.
- Visual/mobile browser acceptance: NOT VERIFIED; the computer-use browser
  inventory is empty. No authenticated browser or real PostgreSQL verification.
- Loopback preview: http://127.0.0.1:3006. Its process inherits the normal local
  environment; do not submit account forms until a disposable target is approved.

## Remaining release requirements

1. Approved isolated PostgreSQL target, pending migration execution and real
   rollback/concurrency/session/role/end-to-end acceptance tests.
2. Counsel/operator sign-off and executable age/guardian verification evidence,
   verified parent provisioning, published policies/contact details and retention.
3. Live sender/provider delivery, a reliable recovery worker schedule/operations,
   retry/dead-letter monitoring, expired encrypted-payload cleanup and key rotation.
   Provider acceptance is not proof of inbox delivery. Response-time uniformity
   and legacy login timing resistance have not been established.
4. Explicit invited-pilot enforcement and any required email/age assurance before
   public activation; these are not supplied merely by the registration form.
5. Mobile/desktop and authenticated accessibility/usability acceptance; actual
   JEE Main/NEET catalog/content coverage remains a later launch-content check.
6. Trusted ingress, distributed limiter live evidence and production readiness
   review. Production authentication/payments are not enabled by Phase 2.

External service/security design references:
[Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
and [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Optional commit and push commands (not executed)

Review before executing: these paths overlap earlier portal/foundation edits in
the report, status, AuthPages and PortalWorkspace. Their complete current contents
will be included. Other pre-existing staged paths are excluded by `--only`.
Generated AGENTS.md/CLAUDE.md are preserved untracked for separate review.

```powershell
$phase2 = @(
  'CONTROLLED_VERIFICATION_REPORT.md', 'MASTER_BUILD_STATUS.md',
  'STUDENT_ACCOUNTS_ONBOARDING.md', 'next.config.ts', 'tsconfig.json',
  'prisma/schema.prisma',
  'prisma/migrations/20261010000600_accounts_consent_recovery/migration.sql',
  'src/app/api/auth/signup/route.ts', 'src/app/account',
  'src/app/admin/accounts', 'src/app/api/account', 'src/app/api/admin/accounts',
  'src/app/api/auth/guardian-consent', 'src/app/api/auth/recovery',
  'src/app/api/auth/reset-password', 'src/app/guardian-registration',
  'src/app/privacy', 'src/app/recover-account', 'src/app/reset-password',
  'src/app/terms', 'src/components/account',
  'src/components/journey/JourneyWizard.tsx',
  'src/components/journey/OperationsWorkspace.tsx',
  'src/components/portal/PortalWorkspace.tsx', 'src/screens/AuthPages.tsx',
  'src/screens/Settings.tsx', 'src/server/auth/session.ts',
  'src/server/auth/validation.ts', 'src/server/auth/account-consent.ts',
  'src/server/auth/recovery.ts', 'src/server/journey/service.ts',
  'src/server/student/service.ts', 'src/server/student/validation.ts',
  'src/shared/account-policy.ts', 'tests/auth/account-consent.test.ts',
  'tests/auth/account-sessions.test.ts', 'tests/auth/recovery.test.ts',
  'tests/auth/signup-route.test.ts', 'tests/auth/signup-ui.test.ts',
  'tests/auth/hardening-routes.test.ts', 'tests/auth/validation.test.ts',
  'tests/student/service.test.ts'
)
git diff -- $phase2
git add -- $phase2
git diff --cached -- $phase2
git commit --only -m "Implement guarded student accounts and onboarding" -- $phase2
git push origin main
```

This increment depends on earlier portal/workspace changes and their migration.
Review and commit those separately if still staged; do not deploy an account-only
commit without its prerequisites. No Git command above was executed by the agent.

## Final Git status

Branch: main. No staging was performed in Phase 2. Existing staged portal paths
remain staged; overlapping files retain both prior staged work and Phase 2
unstaged edits. The global Git ignore file cannot be read in this sandbox (Git
prints a permission warning); no ignore settings were changed. Whitespace check
passed. Next-generated AGENTS.md and CLAUDE.md are preserved, not manually edited.

`git status --short --untracked-files=all`:

```text
AM CONTROLLED_VERIFICATION_REPORT.md
MM MASTER_BUILD_STATUS.md
M  PORTALS_CONSENT_TENANTS.md
 M next.config.ts
A  prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
A  prisma/migrations/migration_lock.toml
 M prisma/schema.prisma
M  src/app/[[...path]]/page.tsx
 M src/app/api/auth/signup/route.ts
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/OperationsWorkspace.tsx
MM src/components/portal/PortalWorkspace.tsx
MM src/screens/AuthPages.tsx
 M src/screens/Settings.tsx
 M src/server/auth/session.ts
 M src/server/auth/validation.ts
 M src/server/journey/service.ts
M  src/server/portal/authorization.ts
M  src/server/portal/service.ts
 M src/server/student/service.ts
 M src/server/student/validation.ts
 M tests/auth/hardening-routes.test.ts
 M tests/auth/signup-route.test.ts
 M tests/auth/signup-ui.test.ts
 M tests/auth/validation.test.ts
M  tests/portal/authorization.test.ts
M  tests/portal/lifecycle.test.ts
A  tests/portal/migration-contract.test.ts
A  tests/portal/workspace.test.ts
 M tests/student/service.test.ts
 M tsconfig.json
?? AGENTS.md
?? CLAUDE.md
?? LAUNCH_FOUNDATION.md
?? STUDENT_ACCOUNTS_ONBOARDING.md
?? config/environments/development.env.example
?? config/environments/production.env.example
?? config/environments/staging.env.example
?? config/environments/verification.env.example
?? postgres-preflight.ts
?? prisma/migrations/20261010000600_accounts_consent_recovery/migration.sql
?? src/app/account/consent/page.tsx
?? src/app/account/guardian-consent/page.tsx
?? src/app/admin/accounts/page.tsx
?? src/app/api/account/consent/route.ts
?? src/app/api/account/guardian-consent/route.ts
?? src/app/api/admin/accounts/route.ts
?? src/app/api/auth/guardian-consent/check/route.ts
?? src/app/api/auth/recovery/route.ts
?? src/app/api/auth/reset-password/route.ts
?? src/app/guardian-registration/page.tsx
?? src/app/privacy/page.tsx
?? src/app/recover-account/page.tsx
?? src/app/reset-password/page.tsx
?? src/app/terms/page.tsx
?? src/components/account/AccountConsent.tsx
?? src/components/account/AdminAccounts.tsx
?? src/components/account/GuardianConsent.tsx
?? src/components/account/RecoveryForm.tsx
?? src/server/auth/account-consent.ts
?? src/server/auth/recovery.ts
?? src/shared/account-policy.ts
?? tests/auth/account-consent.test.ts
?? tests/auth/account-sessions.test.ts
?? tests/auth/recovery.test.ts
?? tests/foundation/postgres-target.test.ts
?? tests/postgres-live/identity.pg.test.ts
?? tests/postgres-live/read-only.setup.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
```
