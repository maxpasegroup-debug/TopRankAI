# TopRank AI launch operations runbook

Prepared 2026-10-13 (Asia/Calcutta). Procedures only: NOT deployment approval.
Initial offering: free invited JEE Main/NEET UG pilot, India/UAE, payments disabled.
No database, backup, restore, migration, provider or deployment command was executed
while preparing this document. Do not run the proposed connected commands until
their specific target, identity, workload, data handling and scope are approved.

## Owners and release evidence

Assign named primary/backup owners for application operations, database recovery,
content publishing, student support/safeguarding and privacy/guardian verification.
Record an escalation contact and coverage hours in the private operator register.
Do not put student details, credentials, connection strings or private references
in public tickets. Use existing authenticated support and audit workflows.

Before any student release obtain evidence for all of:
- Approved isolated PostgreSQL migration replay, constraints, immutable terms,
  real CAS/concurrency/rollback, access expiry/revocation and backup restore drill.
- Authenticated desktop/mobile signup/consent/recovery/session and operator flows.
- Reviewed appropriately licensed content for launch exams, actual published mock
  blueprints, and correct empty/missing-content states.
- India/UAE policy, guardian identity/authority verification and safeguarding
  procedures approved by qualified reviewers. No arbitrary adults-only workaround.
- Live dedicated Upstash tests, trusted-ingress identity, approved recovery delivery.
- Monitoring alert delivery, backup encryption/retention, recovery drill and exact
  release artifact/source revision; no unexplained pending migration or drift.

The /admin/operations flags are runtime configuration, not evidence of these checks.
Its counts are a live sampled queue view, not an accounting ledger or alert service.
External acceptance is explicitly marked not verified by the application.

## Free pilot access and support operation

1. An authorized platform administrator defines boolean features, creates a
   zero-price ONCE package version with approved duration and availability, and
   publishes it. Nothing is seeded by this increment. Package terms remain immutable.
2. Bind intended lessons/mocks to their canonical feature gates. Unbound resources
   keep the established free contract; catalogue metadata is not an answer key.
3. Use Commerce administration's invited package grant with an existing active
   STUDENT ID, package, start and reason. The package determines features and expiry.
   This is an account-bound invitation grant, NOT a public claim token or email invite.
4. Original request IDs are reused on uncertain retries. A replay never extends
   access or restores revoked grants. A different intent needs a new UUID only after
   reviewing the previous result. Full-page reload does not retain the form UUID;
   inspect entitlement/audit history before submitting again.
5. Inspect Entitlements by exact student ID/window; CURRENT includes blocked purchase
   rows for investigation. Withdraw the intended feature grant with a reason. Other
   grants are unchanged; withdrawing one overlapping grant may not remove access if
   another valid grant still covers that feature. Bundle withdrawal is per feature.
6. Registration guardian authorization remains separate from optional progress
   sharing; granting access cannot satisfy policy/guardian checks or activate login.
7. Support queue orders OPEN/IN_PROGRESS ahead of resolved records, bounded to 100.
   Reload before handling a stale response conflict; identical reply retries are safe.
   Review requests unchanged for 48 hours (a queue indicator, not a promised SLA).
   Assign triage/escalation outside the system; no assignment/safeguarding workflow,
   crisis service, live counselling or automated escalation is falsely claimed.

## Runtime configuration separation

Development, disposable verification, staging and production use distinct targets,
principals, secrets, origins and domains. Existing config/environments templates
are planning placeholders, never approval. Keep .env.verification.local separate
from normal .env. Do not copy production data/credentials into developer fixtures.

Minimum blocked-state production planning values (placeholders only):

```dotenv
NODE_ENV=production
DATABASE_URL=<APPROVED_RUNTIME_ROLE_DSN_FROM_SECRET_MANAGER>
APP_URL=https://<APPROVED_CANONICAL_HOST>
AUTH_RATE_LIMIT_ACTIVATED=false
AUTH_RATE_LIMIT_LIVE_VERIFIED=false
AUTH_TRUSTED_PROXY_VERIFIED=false
ACCOUNT_POLICY_REVIEWED=false
ACCOUNT_GUARDIAN_VERIFICATION_APPROVED=false
AUTH_RECOVERY_DELIVERY_VERIFIED=false
```

Never approve flags by copying this file or because a build passed. Existing
AUTHENTICATION_HARDENING.md and STUDENT_ACCOUNTS_ONBOARDING.md specify additional
approved provider/consent/recovery secret prerequisites. Payment and SIA knowledge
factories return null regardless of credentials; no paid offering is enabled here.
Use least-privilege runtime and separate migration/backup principals. Do not log
URLs, tokens, secrets, raw webhook bodies, answers, support messages or consent proof.

## Monitoring plan (operator provisioning pending)

Configure the approved platform's monitoring and authenticated queue review:
- /api/live is database-free process liveness, not readiness. Probe at an approved
  interval; proposed pilot baseline is 60 seconds with escalation after three failures.
- /api/health performs SELECT 1 and is a database-connected readiness check. Do NOT
  invoke it against an unknown target. Do not make a public liveness probe depend on
  it or restart-loop the process during a database outage.
- /api/auth/readiness is a separate auth gate. 503 is expected while blocked; do not
  hide it or turn on flags merely to satisfy an uptime monitor.
- Monitor sanitized 5xx rate/latency, process restarts, CPU/memory, pool pressure,
  storage headroom, database reachability, failed backup jobs and backup age.
- Review support age, pending/ambiguous payment events/refunds (including legacy
  records despite disabled payments), external delivery failures and unverified
  competition settlements using existing operator workspaces.
- Require an actual alert delivery test to a named on-call recipient and a recorded
  incident drill. No monitor, scheduler or notification provider was provisioned here.
- Aggregate operational readings exclude student payloads; the audit summary omits
  actor identity and free-form details, which may contain private consent references.

## Backup and restore plan (NOT EXECUTED)

Proposed pilot targets, requiring owner approval: RPO <=24 hours, RTO <=4 hours;
daily backup plus pre-migration snapshot, seven daily/four weekly recovery points.
These are proposed targets, not measured results or a retention/legal determination.
Approve retention, jurisdiction, encryption, access control and deletion obligations.
Use provider snapshots/PITR if independently supported and tested; none is assumed.

pg_dump/pg_restore/psql were not discovered on PATH in this assessment. Existing
portable binaries may be elsewhere; do not install, start or connect automatically.
Use an approved client compatible with the actual server version, not a guessed
major version. PostgreSQL custom archives are compressed, NOT encrypted. Protect
scratch/output with an approved encrypted volume and transfer to private encrypted
storage outside the repository. Account separately for roles, platform configuration,
secrets and external assets; a single database dump is not a complete platform backup.
See [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

Only after target identity and read approval, with dedicated libpq service/passfile
credentials stored outside the repository (never URLs/passwords on the command line):

```powershell
# PROPOSED ONLY: requires approved source, client and private encrypted output path.
pg_dump --dbname="service=<APPROVED_BACKUP_SERVICE>" --format=custom --no-password --file="<PRIVATE_ENCRYPTED_OUTPUT_PATH>"
# Offline archive inspection; keep its output private and review warnings/exit codes.
pg_restore --list "<PRIVATE_ARCHIVE_PATH>"
```

Record checksum, timestamp, source identity, client/server major versions, exit code,
encryption/access settings and snapshot/job ID in a private evidence register.
Test restoring only a trusted archive into an explicitly approved fresh isolated
empty database. An archive can execute source-authored SQL; inspect it and isolate
restoration from production/external messaging. Do not use --clean or --create to
redirect restoration into an existing/unknown database. Credentials and archived
student/session data require separate privacy approval, even in a disposable target.

```powershell
# PROPOSED WRITE: separate restore authorization and established isolation required.
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="service=<APPROVED_EMPTY_DISPOSABLE_RESTORE_SERVICE>" "<PRIVATE_ARCHIVE_PATH>"
```

Restore with an approved owner, reconcile runtime privileges separately, and validate
migration history, constraints/triggers, row counts and guarded application flows.
Keep network egress and authentication disabled. Approve cloned-session invalidation
and test-data handling explicitly; never delete or alter original user data. Do not
restore directly over production or treat archive listing as a successful drill.
See [PostgreSQL pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

The existing postgres-preflight.ts defaults to OFFLINE checks only. --connect and
the PostgreSQL identity suite require separate read approval and an empty dedicated
target. They are not migration/restore authorization and will reject a populated
restored database. A post-restore identity/validation harness still needs an approved
workload; do not weaken the current guard to make a restore test pass.

## Deployment and recovery gates (PROPOSED ONLY)

1. Review/stage the complete intended source, including earlier uncommitted phase
   dependencies; identify an immutable artifact and source revision. No automatic push.
2. In approved isolated CI, use the lockfile, install/build/test without a production
   datasource; approve any infrastructure or dependency-install workload separately.
3. Confirm exact staging target identity, complete migration order, forward SQL review,
   snapshot and successful restore evidence. Keep runtime and migration credentials
   separate. Never run migrate dev/reset or seed in staging/production.
4. After explicit staging-write approval, proposed commands are:

```powershell
# NOT EXECUTED: approved isolated CI only.
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
# NOT EXECUTED: approved migration principal and exact staging datasource only.
npx.cmd prisma migrate status --config prisma7.config.ts
npx.cmd prisma migrate deploy --config prisma7.config.ts
```

5. Deploy the approved artifact to staging with gates blocked. Validate trusted TLS
   origin, secure cookies, identity forwarding, session expiry, consent, access,
   idempotent grants and operator workflows under bounded reviewed fixtures.
6. Production requires separate identity/write/release approval and the full evidence
   checklist, named owners, rollback-compatible code and an approved maintenance plan.
   No Railway deployment, domain change, webhook activation or runtime install here.
7. On incident: freeze risky writes/provider operations, preserve sanitized evidence,
   identify last known-good artifact and snapshot, and page the owner. Prefer reverting
   to a compatible artifact; forward migrations are not automatically reversible.
   Never reset the database, edit historical migrations or drop new columns as a fix.
8. If restoration is necessary, restore into a new approved isolated target, verify
   recovery and reconciliation, then separately approve any datasource cutover.
   Protect original data. Keep auth/payments disabled until the incident is signed off.

## Future paid launch (not this pilot)

Require approved catalogue/currency/commercial/refund policy, merchant/tax identity,
jurisdiction review, provider sandbox checkout handoff, webhook event verification,
real receipts/refunds and reconciliation tests. Existing adapters/mock tests are not
live payment acceptance. No tax invoices, subscriptions, pooled AI credits, wallets,
provider idempotency, paid checkout or external delivery is certified by this increment.
Do not sell packages until those controls and production wiring are separately approved.
