# Safe development infrastructure

Date: 2026-10-22 (Asia/Calcutta).
Status: LOCAL ISOLATION ESTABLISHED; MIGRATION REPLAY BLOCKED; OVERALL EXIT NOT MET.

## Boundaries

Preserve the existing scope-freeze documents and all unrelated work. No dependency
installation, existing database fallback, reset, truncate, broad deletion, ordinary
seed, production activation, commit, push or deployment is part of this increment.
Fresh local cluster creation and explicitly guarded migration/rollback fixtures are
the only intended database writes. Do not use these commands on hosted databases.

## Workflow

Use existing local dependencies; npm commands below do not install packages.

```powershell
# Fresh setup only: refuses an existing dedicated config or occupied test port.
npm.cmd run verify:postgres:setup -- --create-disposable
# Offline configuration check; no connection.
npm.cmd run verify:postgres:preflight
# Original identity and EMPTY-schema check, read-only connection.
npm.cmd run verify:postgres:preflight -- --connect
# Only if setup left a pending checkpoint; repeats the unchanged empty guard.
npm.cmd run verify:postgres:finalize -- --verify-pending-setup
# Explicit write scope; original empty-target check before Prisma migrate deploy.
npm.cmd run verify:postgres:migrate -- --approve-disposable-writes
# Checks same target, local receipt and exact applied migration checksums first.
npm.cmd run verify:postgres:fixtures -- --approve-disposable-writes
# Optional stop: exact OS identity check, no database query or file deletion.
npm.cmd run verify:postgres:stop -- --stop-owned-target
```

Setup acquires the PostgreSQL 17.11 portable archive from the official EDB HTTPS
distribution, creates a fresh GUID-named directory under LocalAppData/TopRankVerify,
initializes only that new cluster and binds 127.0.0.1:15432. No Windows service,
PATH change, Docker, external database or missing runtime installation is attempted.
Archive traversal checks run before extraction; size/download time are bounded.
The setup receipt stores the source and local SHA-256, NOT an independently obtained
publisher checksum. It records creation evidence, not a legal/compliance certification.

Official source: https://www.enterprisedb.com/download-postgresql-binaries

Expected executable, PG_VERSION, real paths, PID, listener, server identity, database,
ownership and limited role privileges must match before migration. No normal .env
or inherited PG/provider configuration is accepted. The original empty guard stays
strict after migration: it MUST refuse a populated target. Do not weaken it.

Migration runs only migrate deploy against the dedicated config with sanitized child
environment; stdout/stderr are suppressed to avoid leaking secrets. After success,
verify complete ordered migration names/checksums and create an exclusive local receipt.
There is no migrate dev/reset/db push or automatic retry into a partially migrated DB.
On failure preserve the fresh directory and database for bounded review; a failed
run is NOT accepted persistence evidence or authorization to edit historical migrations.

Fixtures create one synthetic student, profile and session in a transaction, check
the joined records and duplicate-email SQL constraint with a savepoint, then ALWAYS
ROLLBACK and check that those IDs left no rows. No real account, login or session
cookie is issued; synthetic fixture password cannot authenticate. This small SQL
smoke check is NOT application-service, concurrency, consent or browser acceptance.
CURRENT TARGET IS PARTIALLY MIGRATED: do not expect the empty preflight, migration
replay or fixture command to succeed against it. No automatic reset or repair exists.

## Runtime lifecycle

The portable server is not installed as a service. Do not register startup tasks.
Its pidfile and server log belong only to the new GUID root. To stop/restart later,
an authorized operator must first recheck the recorded root, executable and PID,
then use that root's pg_ctl.exe -D <EXACT_NEW_DATA_DIRECTORY> stop -m fast (or start
with the same loopback/port options). Never use an unqualified pg_ctl or an existing
service. After restart the PID changes: update only the dedicated expected PID after
OS identity checks, then reverify. Do not print credentials or receipts' fingerprints.
This task does not authorize deleting the cluster, archives or any existing data.

## CI and deployment hold

.github/workflows/ci.yml runs lockfile installation in the GitHub runner, Prisma
generation/validation, offline tests, TypeScript, production build and whitespace
checks. It contains no database service, deployment job, provider credential, secrets
reference or production environment. Local dependencies were not installed by adding it.
CI is prepared code until GitHub actually executes it; it is not remote passing evidence.

CRITICAL: Railway auto-deploy is external to this workflow and railway.json. Read-only
CLI metadata access reported authentication unavailable. Therefore push-triggered
production deployment is NOT VERIFIED DISABLED. Do not push this branch until an
authorized operator confirms production source-branch auto-deploy is disabled (and
records project/environment/service, setting, date and reviewer without secrets),
or establishes and verifies an equivalent explicit-approval deployment control.
CI checks alone and a local hook do not prevent a provider from deploying a push.
No hosting setting was changed; no unconditional push instruction is appropriate.

## Evidence and remaining gates

### Real local execution

- Official portable PostgreSQL 17.11 acquired; no dependency/runtime/service install.
- Three fresh GUID setup roots created. Two earlier failed-bootstrap roots were
  stopped only after OS identity checks and remain preserved, including archives.
  The third is the active target; no unknown/existing application DB was used.
- Initial pg_ctl wrapper inherited handles caused a timeout after actual readiness.
  Fixed startup stdio handling; never killed an arbitrary process or service.
- Live read-only check discovered inet_server_addr()::text includes a netmask;
  changed BOTH identity projections to host(inet_server_addr()). Exact loopback,
  executable/PID/path/role/version/owner and emptiness checks are unchanged.
  Reference: https://www.postgresql.org/docs/17/functions-net.html
- Pending setup finalized only after the unchanged guard passed. Active config has
  current-account-only Windows ACL and is Git-ignored. Pending file removed. The
  normal datasource differs by server/database identity and was NOT connected.
- node node_modules/tsx/dist/cli.mjs postgres-preflight.ts --connect: PASS while empty.
- node node_modules/tsx/dist/cli.mjs verification/run-postgres.ts migrate --approve-disposable-writes:
  FAIL P3018 / SQLSTATE 42P07. Sixteen successful migrations; migration
  20261011000100_daily_study_command_centre failed; three remaining not applied.
- Root cause: 20261009000200_student_journey/migration.sql already creates
  StudyPlan_one_active_per_user. Daily-study migration creates that same named index
  again (WHERE active = true versus the earlier WHERE active). No SQL history changed.
- Bounded READ ONLY migration diagnostic confirmed count/name/relation only; raw
  logs, credentials, connection strings and secret fingerprints were not printed.
- node node_modules/tsx/dist/cli.mjs verification/run-postgres.ts fixtures --approve-disposable-writes:
  EXPECTED REFUSAL because no successful migration receipt exists. No fixture rows
  created; rollback-fixture behavior is tested with mocks, NOT live acceptance.
- Do not mark a failed migration as applied, drop an index, weaken guards, edit old
  migrations or run migrate reset to conceal this. A reviewed migration-history
  reconciliation strategy and clean isolated replay are the next dependency.

### Offline checks actually run

- node node_modules/vitest/vitest.mjs run tests/foundation: PASS, 65 mocked tests.
- Full Vitest run with NODE_ENV=test, RUN_UPSTASH_LIVE_TESTS=false,
  TOPRANK_POSTGRES_READ_SUITE=false and an inert DATABASE_URL: PASS, 1,574 tests,
  two gated live tests skipped (80 passing files, two skipped). These are not live DB tests.
- node node_modules/typescript/bin/tsc --noEmit --incremental false: PASS.
- node node_modules/typescript/bin/tsc --project verification/tsconfig.json: PASS.
- Prisma validate --config prisma7.config.ts in a child with inert placeholder URL:
  PASS; no ordinary datasource connection.
- Next build in a child with TOPRANK_VERIFY_BUILD=infrastructure, inert DATABASE_URL,
  auth/policy/guardian/recovery flags false and NEXT_TELEMETRY_DISABLED=1: PASS,
  64 generation entries in .next/infrastructure-verification. No app server launched.
- Next generated the corresponding tsconfig typing includes; earlier build directories
  and previews were not overwritten. No new packages or application features added.

### Remaining gates and preservation

Remote staging/production provisioning, provider auto-deploy settings, branch
protection and GitHub CI execution remain unverified. See config/environments/README.md
for boundaries, not a claim that templates create remote isolation. Authentication,
consent and recovery activation flags remain disabled locally; payment/knowledge
factories unchanged. No commit, push, deployment, existing application DB connection,
reset, seed, fixture insertion or historical migration edit occurred.

The earlier scope-freeze documents remain in the worktree; no previous work was
discarded. Local PostgreSQL remains running for bounded follow-up; stop only through
the guarded stop command above if desired. Do not delete retained setup attempts.

Final whitespace check: git diff --check PASS. Git confirms no changes to
package-lock.json, prisma/schema.prisma or historical prisma/migrations files.
Final status: 11 modified and 12 untracked paths, nothing staged; includes the three
pre-existing scope-freeze paths. Dedicated active/pending configuration names are
Git-ignored; no secret file is staged. Baseline global-ignore permission and CRLF
warnings remain; no Git configuration was changed.

```text
 M LAUNCH_PROGRAMME_PHASE1_REFRESH.md
 M MASTER_BUILD_STATUS.md
 M config/environments/development.env.example
 M config/environments/production.env.example
 M config/environments/staging.env.example
 M next-env.d.ts
 M next.config.ts
 M package.json
 M tests/foundation/postgres-target.test.ts
 M tsconfig.json
 M verification/postgres-target.ts
?? .github/workflows/ci.yml
?? RELEASE_SCOPE_CHECKLIST.md
?? SAFE_DEVELOPMENT_INFRASTRUCTURE.md
?? config/environments/README.md
?? tests/foundation/postgres-workflow.test.ts
?? verification/finalize-postgres.ts
?? verification/postgres-workflow.ts
?? verification/prisma.config.ts
?? verification/run-postgres.ts
?? verification/setup-postgres.ts
?? verification/stop-postgres.ts
?? verification/tsconfig.json
```

Next task: review and reconcile the duplicate-index migration history without
rewriting already-applied history or bypassing failure markers, then authorize a
clean isolated replay. Fixture/journey persistence remains unaccepted until that
passes. Separately authenticate the hosting control plane and verify production
auto-deploy is disabled or equivalently approval-gated before any push.
