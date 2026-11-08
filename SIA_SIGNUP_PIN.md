# SIA-guided signup, mobile/PIN login and email recovery

Date: 2026-11-08, Asia/Calcutta. Implementation complete; activation BLOCKED.
No real PostgreSQL, Resend or Railway mutation/activation performed.

## Student experience

- Signup: sequential native dialogs for name/mobile -> email -> required country,
  age and policy/guardian authorization -> Resend six-digit email OTP -> choose
  six-digit PIN -> confirm PIN -> /workspace, which routes students to /home.
- Login: international mobile number + six-digit PIN -> role-safe workspace.
- Forgot PIN: email -> OTP -> new PIN -> confirmation -> return to login. Reset
  revokes prior sessions and recovery grants and clears the bound mobile's lockout.
- The popup shell includes SIA prompts, step progress, focus management/native
  dialog keyboard containment, back/close, masked PIN/show checkbox, errors, busy
  states and resend countdown. It uses existing branding, icons and bitmap imagery.
- SIA is the branded guided interface here. Prompts are deterministic; no account
  data is sent to an AI model and no live AI provider was activated.
- Details/secrets stay in current React state, not localStorage, URLs or analytics.
  Incomplete details are not resumable after reload; uncertain finalization should
  be recovered through login/recovery, not a claim that a second account was created.

## Server contract

POST /api/auth/pin, strict action-discriminated bodies, same-origin checks, 4 KiB
limit, no-store responses and existing generic API errors. Actions:

| Action | Required body fields in addition to action |
| --- | --- |
| requestSignup | registration: name, phone, email, country, ageBand, termsAccepted, privacyAccepted, termsVersion, privacyVersion, optional guardianApproval; role defaults to STUDENT and rejects other roles |
| requestReset | email |
| verify | challenge, code |
| signup | challenge, proof, registration, pin, confirmPin |
| reset | challenge, proof, pin, confirmPin |
| login | phone, pin |

OTP requests return a random browser challenge, expiry and resend delay, never the
code. Successful verification returns a short-lived proof. Only a successful final
signup/login issues the existing HttpOnly/Secure production session cookie; session
tokens are not returned in JSON. Reset does not automatically log in and clears
the old cookie. Failed registrations create no user, profile or session.

## Safeguards

- New public users are hardcoded STUDENT. Correct email OTP/proof, unchanged bound
  registration details, current policies and applicable guardian grant are required
  before the atomic user/profile/consent/session transaction.
- Mobile is an explicit +country-code number, 8-15 digits after +. Validation is
  international syntax only, NOT carrier validation or verified mobile ownership.
  Reuse of User.phone's existing uniqueness constraint avoids a second identity model.
- OTPs use crypto.randomInt, including leading zeros. Only a keyed HMAC is stored;
  the browser challenge/proof are high-entropy and stored as hashes. Guardian codes
  and registration details are bound through a keyed digest, not saved in plaintext
  challenge payloads. OTP records contain the destination email and necessary metadata.
- Code lifetime: 10 minutes; proof lifetime after first successful verification:
  five minutes. Five verification attempts maximum per challenge. Wrong attempts
  commit before the validation error; they are not rolled back accidentally.
- Repeated correct verification before finalization returns the same proof without
  extending expiry. Finalization is a one-use transactional claim. Purpose, expiry,
  delivery state, consent and credential version are checked on the server.
- Resend delay 60 seconds, three requests per email/purpose per 15 minutes and ten
  per 24-hour window, plus existing global/client/identity distributed budgets.
  Quota responses use conservative Retry-After values; no code is returned on failure.
- The same verification email is sent for known/unknown reset addresses; a verified
  code alone cannot reset a nonexistent account. Final recovery requires the bound
  active STUDENT, exact canonical mobile and unchanged PIN version.
- PINs are bcrypt-hashed with the existing cost 12; confirmation is server-checked.
  Repeated-digit values and 123456/654321 are rejected. Six digits still have low
  entropy: this is NOT equivalent to a strong password/passkey or MFA.
- PIN guessing is capped across clients using keyed mobile identifiers: five
  attempts per 15-minute window and ten per 24-hour window; successful login or
  verified recovery resets those counters. Denied requests do not extend lockout.
  Unknown mobiles take the dummy-hash verification path and return generic errors.
- Before issuing a session, active student role, hash and credential version are
  rechecked transactionally so a concurrent PIN reset cannot leave a stale session.
- Consent withdrawal now invalidates associated pending OTP recovery grants too.
  Guardian authority is checked before persisting/sending minor signup challenges
  and claimed again inside final signup. No unconditional under-18 exclusion added.
- Ordinary profile updates cannot replace or clear a PIN account's login mobile.
  An unchanged number remains compatible with onboarding. Mobile changes/reclaims
  require an approved verified-support process; no SMS workflow was invented.

## Resend and configuration

Uses native server-side fetch to the fixed https://api.resend.com/emails endpoint,
with redirect rejection, seven-second abort timeout, idempotency key and validated
acceptance response. No dependency installed. Provider acceptance is NOT inbox
delivery. Ambiguous failures are not silently retried or reported as delivered.
API keys, OTPs and PINs are never returned in errors or logged by this workflow.

The environment examples contain placeholders only:

```dotenv
AUTH_PIN_ENABLED=false
AUTH_PIN_EMAIL_VERIFIED=false
AUTH_PIN_HMAC_KEY=<DEDICATED_RANDOM_32_BYTE_OR_LONGER_SECRET>
AUTH_EMAIL_PROVIDER=resend
AUTH_EMAIL_FROM=<VERIFIED_SENDING_EMAIL>
RESEND_API_KEY=<SERVER_ONLY_SENDING_KEY>
```

Do not copy placeholders literally, reuse an existing secret, put keys in
NEXT_PUBLIC variables or set approval flags merely to bypass an unavailable state.
PIN-enabled route approval and email-delivery approval are distinct: the latter
controls new sends. Existing limiter live verification/trusted-ingress approvals,
canonical production HTTPS APP_URL, policy review and minor verification approvals
remain mandatory. Production missing providers/configuration still fails closed.

Resend's send API and idempotency contract:
[Resend documentation](https://resend.com/docs/api-reference/emails/send-email).
Expiry, single-use finalization and guessing defenses follow the principles in
[OWASP account recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
These references do not certify this implementation or replace live verification.

## Schema, compatibility and rollout

- User gains nullable pinHash, pinVersion and emailVerifiedAt. passwordHash remains
  for existing accounts. New PIN users receive a random unusable legacy password
  hash; the legacy login/recovery queries also explicitly exclude PIN accounts.
- EmailOtpChallenge and PinAttemptWindow provide private persisted challenges,
  purpose/binding/version checks, quotas and lockouts. No public listing API exists.
- Forward-only migration: 20261108000100_email_otp_pin, UNAPPLIED. It adds constraints,
  indexes and a user FK. No historical migration was edited. Manifest now has 22
  entries, with an explicit regression assertion. Prisma client generated offline.
- The prior duplicate-index migration replay blocker is NOT repaired here. There
  was no database connection, migration, seed, import or data deletion in this task.
- Old public password signup returns 410; clients must move to the new OTP API.
  Its old success tests were replaced with retirement/no-bypass tests; normal
  student creation/profile/session regression coverage now exercises the PIN service.
- Existing password accounts/staff retain their separate login and recovery. A
  student with an existing canonical mobile may establish a PIN through verified
  email recovery, preserving the same user/history and ending old sessions. Legacy
  missing/national-format phones are NOT silently normalized or converted; they
  retain password access and need a separately approved identity-preserving migration.
- Email verification does NOT prove mobile ownership. Number collisions/reclaims,
  shared-family numbers and legacy normalization/deduplication need an approved
  support/product policy before activation. No mobile-verification claim is made.
- Draft policies now describe PIN/OTP/Resend and version 2026-11-08-draft. Older
  receipts require renewed acceptance, including valid guardian renewal where
  applicable; plan this rollout rather than copying historical consent. Legal,
  contact, retention and privacy-processing approvals remain outstanding.

## Actual verification

| Command/check | Result |
| --- | --- |
| Full guarded offline Vitest command below | PASS: 1,725 passed, two live tests skipped; 86 files passed |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | PASS |
| Offline prisma generate --config prisma7.config.ts | PASS, Prisma Client 7.10.0 |
| Offline prisma validate --config prisma7.config.ts | PASS |
| npm.cmd run build with inert DB/disabled mail/auth, accounts and fresh pin output | BLOCKED: Windows junction creation denied by the local environment, not an observed TypeScript/app error |
| next build --webpack with isolated pin output and inert configuration | PASS on final code; 67 generation entries, types and traces complete |
| Local /signup HTTP preview | HTTP 200; mail/auth and real DB access disabled |
| Browser/mobile visual acceptance | NOT VERIFIED: browser access host unavailable |

Tests cover role/field forgery, malformed/weak/mismatched PIN, international-number
syntax, missing approvals, keyed code storage, quotas, guardian prechecks, code
attempt persistence, expiry/lockout/delivery state, idempotent verification, normal
student/profile/consent/session creation, immutable registration binding, duplicate
identities, one-use claims, unknown email recovery, version/mobile changes, legacy
phone compatibility, session/recovery revocation, daily guessing limits, safe PIN
reset unlock, Resend request/failure handling, HTTP origin/throttle/body/cookie/error
boundaries and initial UI rendering. Persistence and transport are mocked.

The first full run found an outdated profile mock after the new conditional mobile
update. The mock and targeted compatibility/denial tests were updated, then the full
suite passed. No real PostgreSQL rollback/concurrency or email delivery acceptance
was claimed. No new live Upstash, mailbox, browser or Railway test was performed.

```powershell
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_validation'}});process.exit(r.status??1)"
```

Build verification used NODE_ENV=production, TOPRANK_VERIFY_BUILD=pin, telemetry
disabled, an inert loopback port-1 DATABASE_URL and false PIN/mail/policy/limiter
activation flags. Exact final compiler command:

```powershell
node node_modules/next/dist/bin/next build --webpack
```

The default Railway/npm production bundler was NOT changed to Webpack. Turbopack
still needs verification in an environment allowing package junction/symlink
creation, preferably approved Linux CI/staging. No cache deletion, OS permission
change or dependency upgrade was attempted. Existing output was preserved.
Next generated the isolated output's type references in next-env.d.ts/tsconfig.json.

## Preview and remaining acceptance

Local-only UI preview: http://127.0.0.1:3107/signup (login: /login). This preview uses
an inert database and disabled authentication/email; it is NOT a live registration
service. It exists to inspect the interface without writing records or sending OTPs.
The browser connector could not inspect rendering, keyboard behavior or mobile
layout, so responsive styling is implemented but browser acceptance remains pending.

Before activation: safely replay all migrations on an approved disposable target;
verify real account/OTP/reset concurrency, retries and revocation; approve PIN-only
security risk/abuse monitoring and lockout support; establish mobile ownership and
legacy migration policies; verify Resend domain/sender, inbox delivery, quotas/cost
caps, timeouts and restricted secrets; verify live limiter and trusted ingress;
approve policies/guardian SOP and retention/deletion for expired OTP/guard records;
complete browser/mobile/accessibility acceptance and explicitly approve deployment.
OTP/guard expiry prevents authentication use; it does NOT automatically purge rows.

Live AI, production authentication, payments and external delivery remain disabled.
No commit, stage, push, deployment, DB write, migration, seed or installation occurred.
Initial working tree was clean; this task's source/config/test/report changes remain
uncommitted. Existing historical verification reports remain preserved.

Final Git status: main, 26 modified tracked paths, nine untracked files, nothing
staged. git diff --check passed (normal LF/CRLF warnings only). Private .env files
and the lockfile were not changed. Important new code: src/screens/SiaAuth.tsx and
SiaAuth.module.css; src/server/auth/pin-auth.ts and pin-validation.ts;
src/app/api/auth/pin/route.ts; the forward migration and two focused PIN test files.
Canonical login/recovery/sharing/profile services, policies, signup retirement tests,
environment examples and status/checklist documentation carry the related updates.
Preview /signup, /login and /hero/student-laptop.png each returned HTTP 200; this
does not replace interactive browser acceptance.

## Commit/push commands (NOT executed)

The commands cover this coherent authentication increment. Review staged changes;
a push may trigger Railway production deployment. Do not apply migrations or flip
activation flags as part of committing. Push only after approving that deployment.

```powershell
git add -- src tests prisma/schema.prisma prisma/migrations/20261108000100_email_otp_pin config/environments next.config.ts next-env.d.ts tsconfig.json MASTER_BUILD_STATUS.md AUTHENTICATION_HARDENING.md RELEASE_SCOPE_CHECKLIST.md SIA_SIGNUP_PIN.md
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Add SIA-guided email OTP signup and mobile PIN accounts"
# Only after approving Railway deployment:
# git push origin main
```
