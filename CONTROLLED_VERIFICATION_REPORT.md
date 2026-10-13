# Controlled Verification Report

Date: 2026-10-10. Repository: `D:/APPS/WEB/toprank`.
Scope: existing implementation verification, not feature development or deployment.

## 1. Overall status

| Category | Result | Evidence boundary |
| --- | --- | --- |
| Safe environment discovery | PASSED | Presence-only inspection; ordinary database not contacted |
| Focused non-database tests | PASSED | 894 passed, 1 skipped; persistence dependencies mocked |
| TypeScript, Prisma validation/generation, production build | PASSED | Commands below exited 0 |
| Static migration audit | ISSUES FOUND | Missing lock file and nullable-array CHECK gaps |
| Fresh PostgreSQL migration replay and schema drift | BLOCKED | No positively identified disposable target |
| Real PostgreSQL integration/concurrency/rollback | BLOCKED | No safe target or guarded integration harness |
| Authenticated browser acceptance | BLOCKED | No safe target, fixtures or installed browser-test package |
| Live Upstash | BLOCKED / SKIPPED | Dedicated credentials and target confirmation absent |
| Railway trusted ingress | UNVERIFIED | No overwrite/strip/bypass evidence |
| Production activation | DISABLED | Existing fail-closed configuration; no activation performed |

This is not a production-readiness certification. A successful build and mocked
tests do not establish working migrations, distributed correctness or real
authenticated authorization.

## 2. Environment and tools

- Node.js 22.14.0; npm 10.9.2; installed Prisma 7.10.0, Next.js 16.3.5,
  Vitest 5.0.1. Existing TypeScript and PostgreSQL adapter packages are available.
- `psql`, `pg_ctl`, `postgres` and `docker` were not found on PATH. No matching
  PostgreSQL/Docker services or installation at the checked common paths were
  identified. This does not exclude an unknown remote database.
- The local listening-port discovery command for 5432/15432 exited 1 without
  output: port availability was not established. It must be checked again before
  any future container is started.
- Edge and Chrome binaries exist. `playwright`, `@playwright/test` and `puppeteer`
  are not installed. No dependency was installed or service started.
- Existing previews from earlier work were not used for authenticated acceptance.
- Read the seven requested project reports, package/test scripts, authentication
  configuration, readiness checks, Prisma configuration/schema and all 12 SQL
  migrations. No applicable `AGENTS.md` was found in the checked ancestry.

Presence-only inspection covered process variables and `.env`, `.env.local`,
`.env.test`, `.env.test.local`, `.env.verification.local`. Only `.env` exists
among these files and only `DATABASE_URL` was present among the inspected
database/authentication/live-test configuration names. Its value was not printed.
No dedicated target credentials, target confirmation or activation flags were
present in these sources. Other external deployment environments were not inspected.

`.gitignore` excludes `.env` and `.env.*` except `.env.example`, generated Prisma
client output, `.next`, dependency directories and TypeScript build metadata.
Keep real credentials in ignored local files, never in this report or chat.

## 3. Database identity and safety decision

**No PostgreSQL database was used.** The configured `DATABASE_URL` has not been
positively identified as disposable; connecting to it for discovery is forbidden.
`TEST_DATABASE_URL`, `SHADOW_DATABASE_URL`, `POSTGRES_TEST_URL` and the inspected
PG connection variables were absent. No migration status, SQL query, seed,
reset, schema push or database health request was executed.

`prisma7.config.ts` loads dotenv and selects `DATABASE_URL`, not
`TEST_DATABASE_URL`. Merely adding a test URL does not redirect existing Prisma
commands. A separate guarded configuration with no ordinary-URL fallback is a
prerequisite to live database work. Do not run the current default migrate or
seed scripts against the unidentified `.env` target.

The schema-to-SQL command in section 9 compares an empty schema description with
the local Prisma schema. It does not connect to PostgreSQL, replay historical
SQL, create a shadow database or inspect an applied migration ledger.

## 4. Migration audit and actual results

All 12 migrations are now in committed history, in this order:

| Migration | Static review |
| --- | --- |
| `20260916000100_initial_foundation` | Base enums, tables, relations and indexes |
| `20260916000200_student_onboarding_foundation` | Onboarding field; exam catalogue inserts/upserts and JEE archival |
| `20260916000300_content_foundation` | Content models/flags; subject-code backfill and uniqueness |
| `20260916000400_question_bank_foundation` | Questions, options and exam relations |
| `20261009000100_protected_numerical_answers` | Protected text answers and publication downgrade for unresolved answers |
| `20261009000200_student_journey` | Journey models and active-plan/session partial unique indexes |
| `20261009000300_practice_attempts` | Persisted practice attempts and scoring mode |
| `20261009000400_help_and_audit` | Help requests and audit events |
| `20261010000100_timed_mock_exams` | Exam/attempt/answer models and deadline/lifecycle checks |
| `20261010000200_competitions_achievements` | Competition/result/achievement models and audit detail |
| `20261010000300_commerce_foundation` | Commerce models, relations, constraints and triggers |
| `20261010000400_portal_consent_tenants` | Portal membership/enrollment/invitation models, consent and composite tenant relations |

Actual database applied/pending status is **unknown**. Earlier reports calling
migrations unapplied are historical statements, not a current ledger query.
There was no actual migration replay, rollback test or live schema comparison.

### Static inventory

Generated expected DDL from the current Prisma schema, then compared table,
index and foreign-key names with historical SQL using a local text inventory:
49 expected tables matched 49 migration-created tables; all expected index names
and 68 expected foreign-key names were found. This name inventory is not a full
SQL parser and does not prove column types, constraint semantics, trigger
execution or successful deployment. Both `CommerceRefund_orderId_fkey` and
`CommerceRefund_paymentId_fkey` are present in the current committed migration;
an earlier suspected omission was cleared after rechecking the updated tree.

The history additionally contains older `Chapter_status_idx` and
`Lesson_status_idx` and six intentional partial unique indexes:
`StudyPlan_one_active_per_user`, `StudySession_one_active_per_user`,
`MockAttempt_one_active`, `CommercePackage_one_published_code`,
`SchoolEnrollment_one_active_student`, `PortalInvitation_one_pending_target`.
Preserve these and custom triggers when assessing future database drift;
absence from generated Prisma DDL is not justification for dropping them.

### Findings requiring follow-up

1. **Missing migration lock:** `prisma/migrations/migration_lock.toml` is absent.
   The schema provider is PostgreSQL. Restore the provider lock in a separately
   reviewed change; do not invent database migration checksums. Prisma expects
   the migration directory, including the provider lock, to be versioned.
   [Prisma migration histories](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/migration-histories).
2. **Nullable-array CHECK gaps:** commerce `features TEXT[]` and portal
   enrollment/guardian `scopes TEXT[]` permit SQL NULL. Their cardinality-based
   CHECKs can consequently accept invalid rows when the other required terms
   are satisfied. PostgreSQL accepts a CHECK whose expression is NULL, not only
   true. This is a statically established integrity gap, not an executed SQL
   reproduction or a demonstrated API privilege escalation. Application input
   validation does not substitute for the database invariant.
   [PostgreSQL CHECK semantics](https://www.postgresql.org/docs/17/ddl-constraints.html).
3. **Subject-code upgrade collisions:** `UPPER(REPLACE(slug, '-', '_'))` can map
   distinct slugs such as `a-b` and `a_b`, or case variants, to the same code
   before creation of a unique index. Existing-data collisions were not queried.
   Empty-database replay alone cannot verify this populated-upgrade behavior.
4. Guardian consent enforcement uses a `NOT VALID` constraint, leaving legacy
   rows unvalidated. Application access fails closed, but existing rows need an
   approved review before constraint validation; never manufacture consent.
   Legacy memberships require explicit verification rather than automatic trust.
5. Enum alterations require a compatible PostgreSQL version; the future
   disposable setup below targets PostgreSQL 17. Chronological dependencies look
   consistent statically, but server parsing and transactional compatibility
   remain unverified.

Proposed forward-only array correction: add explicitly non-null and bounded
cardinality requirements for package features and ACTIVE relationship scopes.
Inspect existing invalid rows on an approved target before validating new
constraints or changing nullability. Do not silently backfill active consent or
edit committed historical SQL. A collision in an earlier backfill can require
approved pre-migration data remediation; a later migration cannot rescue an
earlier statement that already fails.

The numerical migration preserves numeric precision as text, copies only an
unambiguous eligible correct option, downgrades unresolved published numerical
questions, and deactivates legacy options without deleting their rows. These
backfill paths need populated PostgreSQL fixtures before release.

## 5. PostgreSQL integration versus mocks

**Real PostgreSQL tests run: zero.** No fixtures or integration tests were added
without a safe infrastructure target. The executed suite mocks persistence and
provider dependencies. `tests/db/prisma.test.ts` checks client/model availability,
not PostgreSQL persistence; it was excluded rather than labelled integration.

Still BLOCKED on real PostgreSQL: signup/profile persistence; numerical answer
storage and DTO boundaries; timed attempts/save/deadline/scoring/finalization;
competition ranking and unique achievements; orders/capture/webhook deduplication;
refund/entitlement adjustment; institution isolation; current consent/revocation;
staff removal; concurrent unique enforcement; transaction rollback and recovery.
Mocked service cases cover many of these paths but cannot prove database locking,
isolation, foreign-key behavior, SQL execution or cross-process races.

## 6. Authentication and authorization findings

The source review and executed unit/route tests support the following controls.
None of these rows constitutes live authenticated acceptance.

| Control | Current evidence |
| --- | --- |
| Student-only public signup | Literal STUDENT schema/default and server-assigned role; manipulated roles rejected in tests |
| Production login/signup fail closed | Missing runtime limiter/configuration produces controlled 503 before auth persistence in tests |
| Origin/body checks | Exact origin and bounded 4096-byte request handling tested; forwarding headers not origin authority |
| Logout | GET 405; POST origin validation, hashed session revocation and cookie clearing tested |
| Session identity | Server session lookup resolves active user/current role; client student/tenant IDs do not establish authority |
| Numerical answer privacy | Response allowlists exclude protected answers in executed tests |
| Parent and institution access | Current relationship/consent/membership/institution checks and cross-scope denials tested with mocked DB |
| Revocation/removal | Subsequent service calls recheck authorization in mocked tests; real session/browser effects unverified |
| Competition/award operations | Role and ownership scopes covered by existing tests |
| Commerce entitlement grants | Server-verified capture required; client success is not grant authority |
| Notifications/share links | Ownership, current consent and restricted share data covered by tests; no external sending activated |
| Errors/logging | Controlled API envelopes and selected redaction tests; no live operational log audit |

Razorpay verification uses raw-body HMAC-SHA256 before payload parsing, validates
the configured account, and identifies duplicate events by event ID. This matches
the documented signature and duplicate-event contract; delivery order must not
be assumed. Tests use a test provider and mocked transport, not real webhook
delivery. Secret rotation/retry policy still needs operational verification.
[Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

The test refund transport uses the documented `X-Refund-Idempotency` header with
a stable request key. The provider documentation requires at least 10 characters,
whereas the adapter currently validates 1-40 and its provider test uses
`refund-key` (10 characters). The service supplies the saved refund ID, rather
than a client-selected provider key. Tighten the adapter's lower bound in a
separate reviewed change; no short-key live failure was demonstrated. No real
refund request was sent.
[Razorpay idempotent refunds](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md).

`configuredCommerceProvider()` remains null; payments/webhooks are not activated.
External messaging was not enabled. Production signup/login remain blocked by
the existing runtime gate in the inspected configuration. This is source plus
mock-test evidence, not a request to an externally deployed production service.

## 7. Authenticated browser acceptance

| Role/scenario | Result |
| --- | --- |
| Student sign-in/onboarding/missions/study | BLOCKED / NOT RUN |
| Student mock start/resume/submit/review | BLOCKED / NOT RUN |
| Student results/achievements/packages and disabled payment | BLOCKED / NOT RUN |
| Parent linked-only access, other-student denial, revoke/next-request denial | BLOCKED / NOT RUN |
| Teacher/school-admin tenant isolation and membership-removal denial | BLOCKED / NOT RUN |
| Unauthorized administration and authorized tenant/privacy boundaries | BLOCKED / NOT RUN |

No authenticated browser, account provisioning, seed command, session-cookie
injection or production authentication route was used. API visibility and a
hidden button are not authorization evidence. The build proves compilation,
not these user journeys.

After the database prerequisites below, use legitimate authentication in a
non-production process bound exclusively to the verified target. Store minimal
fixture credentials locally in an ignored file. An existing installed browser
can support manual acceptance if a test runner is not available; an automated
runner installation needs separate approval. Verify both UI and API denials,
including next-request revocation, with different accounts and institutions.

## 8. Upstash and trusted ingress

No REST endpoint/token or dedicated target settings were present. The existing
live test was skipped by its gate. No Upstash request was made.

Required live-test names, to configure locally after console confirmation:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- `AUTH_RATE_LIMIT_TEST_TARGET=dedicated-upstash-free`.
- `AUTH_RATE_LIMIT_TEST_ENDPOINT_SHA256`: 64 lowercase hex characters containing
  SHA256 of the canonical HTTPS REST origin, without a trailing slash. Never
  print the actual fingerprint, URL or token.
- `RUN_UPSTASH_LIVE_TESTS=true` only for the bounded dedicated run.
- Leave `AUTH_RATE_LIMIT_ACTIVATED` unset/false. Do not set production activation
  or live-verification attestations to make a sandbox test pass.

Independently confirm dedicated purpose, Free plan, absence of production data
and inability to incur paid usage. A matching fingerprint binds a confirmed
origin; it does not discover account ownership, plan or disposable status.

The existing harness uses a unique `live_` namespace, synthetic identities,
10-second auth TTLs, five-second probes and at most 24 REST requests. It checks
Lua allow/deny, separate budgets, eight concurrent consumes across two adapters,
identity isolation, TTL expiry, probes and invalid-token recovery. It inspects
only captured keys, with no scan, deletion or flush. These behaviors were NOT
verified live. Timeout/cancellation, malformed responses and outage behavior
were covered with mocks, not live outage injection.

Runtime wiring additionally needs namespace/key secret, an HTTPS `APP_URL`,
`AUTH_TRUSTED_CLIENT_HEADER`, `AUTH_TRUSTED_PROXY_VERIFIED`, and separately
approved live-verification/activation flags. Only the reserved
`x-toprank-client-ip` contract is accepted; arbitrary forwarding headers are not
trusted identity. Railway strip/overwrite and direct-origin bypass prevention
remain **unresolved**. No ingress attestation or configuration was changed.

Future command, NOT EXECUTED, after all dedicated target checks:

```powershell
node --env-file=.env.upstash-test.local node_modules/vitest/vitest.mjs run tests/auth/upstash-live.test.ts --no-cache --no-fsModuleCache --configLoader runner
```

Use an ignored dedicated file and check process-variable precedence and target
matching before running. Never load unknown production credentials for this test.

## 9. Executed commands and outcomes

Working directory for commands: `D:/APPS/WEB/toprank`.

```powershell
node node_modules/vitest/vitest.mjs run tests/auth tests/question tests/content tests/student tests/mock tests/competition tests/commerce tests/portal --no-cache --no-fsModuleCache --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate --config prisma7.config.ts
node node_modules/prisma/build/index.js generate --config prisma7.config.ts
npm.cmd run build
node node_modules/prisma/build/index.js migrate diff --from-empty --to-schema prisma/schema.prisma --script --output .next/controlled-expected-schema.sql
git diff --check
```

| Command | Actual outcome |
| --- | --- |
| Vitest focused suite above | Exit 0; 894 passed, 1 skipped; 38 passed files, 1 skipped file; 19.87 seconds |
| TypeScript | Exit 0 |
| Prisma validate | Exit 0; schema valid |
| Prisma generate | Exit 0; client generated locally |
| Production build | Exit 0; compilation, TypeScript and 37 static pages completed |
| Empty-to-schema DDL generation | Exit 0; local schema-only artifact, not migration replay |
| Tracked diff whitespace check | Exit 0 |

This broad focused run intentionally excludes `tests/db`; it is not labelled a
full-suite or database integration result. No code changes warranted another
expensive full run. Build/generation artifacts are ignored, not source changes.

Read-only discovery also used:

```powershell
git status --short --untracked-files=all
git log -1 --format="%H %D"
git log -3 --format="%h %s"
npm.cmd --version
Get-Command node,npm.cmd,psql,pg_ctl,postgres,docker -ErrorAction SilentlyContinue
Get-Service | Where-Object { $_.Name -match 'postgres|docker' }
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(5432,15432) } | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress
```

Git commands succeeded with warnings that the user-level global ignore file
could not be read. PATH discovery found node/npm only; missing-command lookup
exited 1. Service discovery exited 0 with no matching services. Port discovery
exited 1 without output; it does not establish that ports are unused.
Local package/file and environment diagnostics used Node filesystem APIs and
`node:util.parseEnv`, emitting names and presence booleans only. SQL name inventory
was a local Node/text inspection, not server execution. Source/report reads used
`Get-Content -LiteralPath ... -Encoding UTF8` and targeted `rg` searches.

NOT EXECUTED: migrate status/deploy/dev/reset, db push, db seed, database health
queries, real PostgreSQL tests, authenticated browsers, live Upstash, provider
payments/refunds, installation, provisioning or deployment.

## 10. Defects, fixes and blockers

No application code, schema or historical migration was edited. The only authored
file is this report. No defect was hidden by weakening tests or security gates.
The missing provider lock and NULL-sensitive constraints require separately
reviewed corrections; the backfill collision and legacy-validation risks require
approved data checks. Current SQL inventory clears the suspected refund-FK gap.

Primary blockers are an unidentified ordinary DB URL, missing disposable target
and guarded PostgreSQL harness, unavailable browser test package/fixtures,
missing dedicated Upstash settings and unverified Railway ingress. Static passes
do not clear any of these blockers.

## 11. Prioritized release prerequisites and setup

1. Approve an isolated PostgreSQL target and any separately necessary software
   installation. No software/service creation is authorized or performed here.
2. Create a fresh disposable PostgreSQL 17 instance, then prove its identity and
   approved ownership/purpose before application writes. Do not reuse unknown
   volumes, host data directories or databases.
3. Add a separately reviewed guarded Prisma/test configuration requiring an
   explicit `TEST_DATABASE_URL` and positive disposable-target confirmation,
   with no `DATABASE_URL`/dotenv fallback. This configuration does not yet exist.
   Recheck process environment precedence; a filename or database name alone is
   not safety proof.
4. Restore the migration provider lock and review the forward-only integrity
   correction. On the verified target, replay the existing ordered migrations,
   inspect migration status/ledger and compare the actual schema including
   partial indexes, constraints and triggers. Exercise populated-upgrade fixtures
   for numerical backfill, subject collisions and legacy consent separately.
5. Add/run real PostgreSQL persistence, race, rollback and uniqueness tests for
   every scenario in section 5. Fixtures and cleanup must be exclusively scoped
   to test-created records.
6. Run legitimate authenticated browser and API acceptance for every section 7
   scenario using the verified target and non-production configuration only.
7. Configure/verify the dedicated Upstash sandbox and run the gated test; separately
   demonstrate reserved-header replacement and origin-bypass prevention at ingress.
8. Review privacy/consent operations, webhook retries/rotation, monitoring,
   provider costs and private staging configuration. Activation and Railway
   deployment require separate authorization after these checks pass.

### Proposed local Docker setup (not executed)

If Docker is separately installed and starting a container is approved, create
ignored `.env.pg-disposable.local` containing locally generated `POSTGRES_USER`,
`POSTGRES_DB` and a strong `POSTGRES_PASSWORD`. Do not paste these values into chat.
Check loopback port 15432 is unused before proceeding. Use fresh names/volumes:

```powershell
$suffix = [guid]::NewGuid().ToString('N')
$name = "toprank-verification-$suffix"
$volume = "toprank-verification-data-$suffix"
docker run --name $name --label toprank.purpose=disposable-verification --publish 127.0.0.1:15432:5432 --mount "type=volume,source=$volume,target=/var/lib/postgresql/data" --env-file .env.pg-disposable.local --detach postgres:17
docker inspect --format '{{.Id}} {{.Config.Image}} {{json .Config.Labels}} {{json .HostConfig.PortBindings}} {{json .Mounts}}' $name
```

These are future instructions, not evidence of a created target. Confirm fresh
container/volume creation, exact loopback mapping, operator ownership and no
valuable data. Inspect metadata only, never full environment output. The volume
mount follows the official PostgreSQL 17 image layout.
[Official PostgreSQL image](https://hub.docker.com/_/postgres).

Configure the resulting URL locally in ignored `.env.verification.local` under
the future guarded configuration. Do not put it in the ordinary `.env` or run
default migration scripts. After the guard is implemented and target identity
positively confirmed, inspect the isolated server identity/empty schema, deploy
migrations and check status with that explicit config. No ready-to-run default
deployment command is offered because it currently selects the unknown URL.
Do not reset, flush or remove existing volumes; any future cleanup needs its own
explicit scope and authorization.

## 12. Git state and safety confirmation

Branch: `main`. Current audited HEAD:
`38f2c50ff893af29d130d3fc4919e8873356aa4f`,
`Add connected portals, consent and tenant isolation`.

Initial discovery observed HEAD `544b9f3a6d4ba3deb3c10b2cfa65fda8ea4eaf42` with
14 modified and 75 untracked paths. During the audit an external/user commit
changed HEAD to `38f2c50` and the tree became clean. The agent did not make that
commit or push. A preservation baseline was then captured for 332 tracked and
nonignored files, excluding this report. Local `origin/main` decoration points
at the current HEAD, but no fresh remote synchronization check was performed.

Final expected status after this report: only
`?? CONTROLLED_VERIFICATION_REPORT.md`. The final status command confirmed this
as the complete modified/untracked list. All 332 baseline files remained
byte-for-byte unchanged, including historical SQL. `git diff --check` passed.
`git diff --no-index --check -- NUL CONTROLLED_VERIFICATION_REPORT.md` reported
no whitespace errors; exit 1 reflects the new-file difference and Git emitted
only an LF-to-CRLF conversion warning. No staging operation was performed.

No agent commit, push, pull, branch switch, stash, reset, installation, deployment,
production activation, database connection/migration/seed or live provider write
occurred. Existing user work and historical SQL were preserved. No credential,
connection string, token, cookie or target fingerprint is included in this report.

## 13. Guarded database verification follow-up

Date: 2026-10-10. This appended audit supersedes the earlier status/counts for
the current working tree while preserving all preceding evidence. Branch remains
`main`, HEAD `38f2c50ff893af29d130d3fc4919e8873356aa4f`. The portal continuation
is still uncommitted; it includes a 13th migration and the provider lock.

### Current outcome

| Category | Result this phase |
| --- | --- |
| Environment/configuration discovery | Completed, read-only and presence-only |
| Disposable database identity and approval | BLOCKED: no identified target or target-specific approval |
| Historical migration replay/status | BLOCKED: zero migrations attempted |
| Live schema drift, constraints, indexes and backfills | NOT VERIFIED |
| Real PostgreSQL integration | BLOCKED: zero real database tests |
| Authenticated browsers/APIs | BLOCKED / MANUAL / NOT VERIFIED, all roles |
| Existing focused non-database suite | PASS: 932 passed, 1 live Upstash test skipped |
| TypeScript and Prisma schema validation | PASS |
| Local expected-DDL/name inventory | Completed, static evidence only |
| Live Upstash / Railway ingress | BLOCKED / UNVERIFIED |
| Production integrations | Remain disabled; no activation performed |

**No database was contacted.** This is a prerequisite block, not a migration
failure. There is no SQL error or successful migration to report. No database
content, migration ledger or deployed application was inspected. The safe portion
of this phase is complete; live work must stop until the target is approved.

### Environment and configuration classification

- Node 22.14.0, npm 10.9.2, Prisma 7.10.0, Next 16.3.5, Vitest 5.0.1 and
  TypeScript 5.9.3 are available locally. Existing pg/Prisma PostgreSQL adapter
  packages are installed; this alone does not supply a PostgreSQL server.
- PATH lookup found node/npm only. PostgreSQL client/server commands and Docker
  were absent. No matching services or PostgreSQL/Docker installation at the
  checked common paths was found. An unknown remote server is not ruled out.
- Edge/Chrome binaries are present; Playwright, @playwright/test and Puppeteer
  packages are absent. Existing previews were not used for authenticated testing,
  started, stopped or otherwise reconfigured in this phase.
- The only root environment files found were `.env` and `.env.example`.
  Among the inspected actual configuration names, only `DATABASE_URL` was
  present in `.env`; none was present in the process. Example configuration is
  not evidence of a configured target. No values were printed.
- `TEST_DATABASE_URL`, `SHADOW_DATABASE_URL`, `POSTGRES_TEST_URL`, PG connection
  variables and dedicated local verification/container/Upstash env files were
  absent. No documented disposable target or explicit target-specific approval
  was identified. The ordinary URL remains **UNIDENTIFIED / DO NOT CONNECT**.
- Activation, live-verification and trusted-ingress flags were absent/not
  enabled; Upstash credentials and its dedicated test-target settings were absent.

Both `prisma7.config.ts` and `src/server/db.ts` select the ordinary
`DATABASE_URL`. `TEST_DATABASE_URL` alone redirects neither migrations nor the
application. No guarded PostgreSQL configuration/harness currently exists.
Default deploy, seed, schema-push and database-health commands therefore remain
unsafe on this configuration. A future test configuration must require its
explicit approved target, reject missing/mismatched configuration and have no
fallback to the ordinary environment. Browser/application workers need the same
binding before importing the cached Prisma singleton.

### Current migration findings

Read the schema and all 13 SQL files again. The first 12 committed SQL files and
schema have no tracked difference from HEAD. The existing untracked 13th file
and lock were inspected but not edited, applied or claimed as committed.

| Ordered migration | Actual database execution this phase |
| --- | --- |
| `20260916000100_initial_foundation` | NOT RUN |
| `20260916000200_student_onboarding_foundation` | NOT RUN |
| `20260916000300_content_foundation` | NOT RUN |
| `20260916000400_question_bank_foundation` | NOT RUN |
| `20261009000100_protected_numerical_answers` | NOT RUN |
| `20261009000200_student_journey` | NOT RUN |
| `20261009000300_practice_attempts` | NOT RUN |
| `20261009000400_help_and_audit` | NOT RUN |
| `20261010000100_timed_mock_exams` | NOT RUN |
| `20261010000200_competitions_achievements` | NOT RUN |
| `20261010000300_commerce_foundation` | NOT RUN |
| `20261010000400_portal_consent_tenants` | NOT RUN |
| `20261010000500_portal_scope_integrity` | NOT RUN |

Current observations and changes from the earlier audit:

1. The missing-lock finding is resolved in the working tree:
   `migration_lock.toml` pins `provider = "postgresql"`. It is still untracked;
   no database migration-checksum comparison was performed.
2. The new portal migration explicitly rejects null, empty, oversized,
   multidimensional, unknown or null-element ACTIVE scopes, with a four-scope
   guardian allowlist and six-scope enrollment allowlist. This is a reviewed SQL
   intent/text contract, not a live enforcement result. Both checks are NOT VALID:
   existing rows are not certified, although new/updated rows must satisfy an
   installed constraint. Approved legacy-data review remains necessary.
   [PostgreSQL constraint validation](https://www.postgresql.org/docs/17/sql-altertable.html).
3. Duplicate scopes remain rejected by application validation, not database
   array uniqueness. Non-ACTIVE legacy arrays are not repaired by the new SQL.
4. `CommercePackage.features` remains nullable under its cardinality CHECK;
   the portal-only migration does not correct that separate integrity gap.
   Recommend a separately reviewed forward correction with explicit null
   rejection and existing-row review, not a historical edit or silent backfill.
5. Subject-code normalization can still collide on populated upgrades. No
   actual collisions were queried. A new empty database cannot prove the legacy
   upgrade case; use approved populated fixtures before release.
6. Numerical-answer backfill, mock lifecycle constraints, competition uniqueness,
   commerce immutable triggers, tenant composite foreign keys and invitation
   partial uniqueness remain unexecuted. The onboarding migration contains
   catalogue writes; migration replay is not a read-only operation.

Generated local expected DDL and compared names: **49 expected tables / 49
created tables**, no missing expected table/index names, and **68 expected FK
names** found (including inferred conventional names for unnamed inline FKs).
The eight additional index names remain the two old status indexes and six
intentional partial unique indexes listed in section 4. Both refund foreign keys
are present. Preserve custom checks/triggers/partial indexes in any future drift
review. This text inventory is not a SQL parser, database introspection or proof
of column/constraint/type equality. Actual schema discrepancies remain unknown.

### Critical PostgreSQL and browser results

Real PostgreSQL results are **zero**, not 932. The existing suite exercises
unit/route contracts and mocked persistence; its migration tests inspect SQL
text. `tests/db/prisma.test.ts` only checks client model properties and was
excluded. It is not a database integration harness.

All real checks remain BLOCKED: signup/profile persistence; protected numerical
answer storage and API allowlists; mock scoring/idempotent finalization;
competition rankings/duplicate achievements; order capture/event idempotency;
institution and guardian isolation; relationship revocation/staff removal;
transactions, rollback, unique constraints and concurrent writes. No fixture,
seed or cleanup was created or executed.

| Authenticated role/scenario | Current result and blocker |
| --- | --- |
| Student sign-in, workspace routing and learning | NOT RUN: no safe DB/accounts/test environment |
| Parent linked-student access and unrelated-student denial | NOT RUN: no safe DB/verified relationship fixtures |
| Consent revocation and next-request denial | NOT RUN: no authenticated sessions or live persistence |
| Teacher and school-admin tenant boundaries | NOT RUN: no verified tenant/membership fixtures |
| Staff removal and subsequent denial | NOT RUN: no live membership/session verification |
| Restricted platform administration | NOT RUN: no authorized test accounts |
| Package browsing with payments disabled | NOT RUN authenticated; production commerce remains disconnected |

No authenticated API or browser flow was run. Available browser binaries do not
remove the target/fixture blocker. Manual acceptance remains possible later with
existing browsers, but has not occurred. No runner installation was performed.

### Exact checks executed this phase

```powershell
node node_modules/vitest/vitest.mjs run tests/auth tests/question tests/content tests/student tests/mock tests/competition tests/commerce tests/portal --no-cache --no-fsModuleCache --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate --config prisma7.config.ts
node node_modules/prisma/build/index.js migrate diff --from-empty --to-schema prisma/schema.prisma --script --output .next/guarded-expected-schema.sql
git diff --exit-code -- prisma/schema.prisma prisma/migrations
git diff --check
git status --short --untracked-files=all
git log -1 --format="%H %D"
npm.cmd --version
Get-Command node,npm.cmd,psql,pg_ctl,postgres,docker -ErrorAction SilentlyContinue | Select-Object Name,Source | ConvertTo-Json -Compress
Get-Service | Where-Object { $_.Name -match 'postgres|docker' } | Select-Object Name,Status | ConvertTo-Json -Compress
rg --files tests | Select-String '(db|integration|live|portal)'
```

Vitest exited 0: **932 passed, 1 skipped; 40 passed files, 1 skipped file;
12.99 seconds**. TypeScript, Prisma validation, local DDL generation, tracked
migration/schema comparison and whitespace checks exited 0. PATH discovery
exited 1 because requested database/container tools are missing; service lookup
exited 0 without matches. Git warned about the unreadable global-ignore file and
LF-to-CRLF conversion, not whitespace defects. Node filesystem/package and
`node:util.parseEnv` diagnostics emitted presence/version data only. Migration
inventory used local text inspection and did not connect to PostgreSQL.

The schema diff is empty-to-local-schema, not database-to-schema. Build and client
generation passed in the preceding continuation but were not rerun or relabelled
as current-phase results; no application code changed in this phase. This was
not a full-suite run. The dedicated live Upstash test was skipped, not passed.

NOT RUN: database identity queries, migration status/deploy, schema push/reset,
seeding, real SQL integration, authenticated browsers, provider writes or cleanup.
No new defect fix or feature was made in this phase: only this report was appended.

### Simplest safe setup and authorization boundary

The local Docker procedure in section 11 remains a future procedure, not an
executed setup. Docker is not currently available in the inspected environment.
Software installation and service/container creation need separate approval.

1. Obtain approval for a new isolated local PostgreSQL 17 container. If software
   is absent, install/configure it separately only after approval; this phase
   authorizes neither installation nor starting a service.
2. Store newly generated `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` in
   ignored `.env.pg-disposable.local`. Keep credentials out of command arguments,
   console output, reports, Git and chat. Recheck that loopback port 15432 is free.
3. Use fresh GUID-suffixed container and volume names, check that neither exists,
   then use the approved `docker run` procedure from section 11. Bind loopback
   only, use the fresh volume and PostgreSQL 17 data-directory mount; never reuse
   a host data directory or unknown volume. Pin/record the actual image identity.
   [Official PostgreSQL image](https://hub.docker.com/_/postgres).
4. Inspect only container ID/image, purpose label, exact port mapping, volume
   identity and creation metadata. Never dump the container environment. Record
   ownership, dedicated test purpose and that no valuable data exists. A label,
   name or matching endpoint alone is insufficient proof of disposability.
5. Configure `TEST_DATABASE_URL` locally in ignored `.env.verification.local`,
   matching that exact approved instance and database. Do not change the ordinary
   `.env`. A separate fail-closed Prisma/test/application target binding is still
   required; the repository does not currently implement it. It must reject any
   ordinary-URL fallback, conflicting process override or mismatched target before
   creating a client. Configure secret values locally, not in chat.
6. Supply explicit approval for migration replay and scoped fixture/test writes
   **on the now-identified instance**. Non-secret container/volume/port metadata
   and approval scope are enough for discussion; do not send credentials. No
   database write should precede this approval. After identity is established,
   use guarded read-only checks to confirm the intended server/database and empty
   application schema before migrations. Stop if the identity or emptiness differs.
7. Apply the 13 existing migrations chronologically using Prisma deploy with the
   explicit guarded config, recording each result and sanitized failure. Inspect
   status/ledger and actual schema afterward, including partial indexes, checks
   and triggers. Do not use schema-push, reset or historical SQL edits as repairs.
8. Run isolated real database fixtures and scoped cleanup for the critical flows
   above, including race/rollback/uniqueness and populated-backfill cases. Then run
   legitimate authenticated browser/API role scenarios against this target in a
   non-production process. Production authentication/payment/messaging gates stay
   unchanged; do not disable them to pass acceptance.

No default migrate/seed command is offered for execution now because it still
selects the unknown URL. No ready-to-run guarded config or real integration test
command exists yet. Establish the approved target and fail-closed binding first.
Remote disposable infrastructure is an alternative only after independent
ownership/purpose/no-valuable-data evidence and explicit scoped approval.

### Remaining external blockers

Dedicated Upstash endpoint/token, target marker, endpoint confirmation and gated
live run remain missing. No REST call was made; no production activation flags
were set. Railway reserved-header stripping/replacement and direct-origin bypass
prevention remain unverified. Payments/webhooks and external messaging remain
disabled; no account, plan, resource, credential or integration was activated.
Legal guardian/institution consent policies and operational staging approval
remain external requirements. **Production readiness is not established.**

### Current Git and preservation

Status at this phase, unchanged in path inventory after appending this report:

```text
 M MASTER_BUILD_STATUS.md
 M PORTALS_CONSENT_TENANTS.md
 M src/app/[[...path]]/page.tsx
 M src/components/portal/PortalWorkspace.tsx
 M src/screens/AuthPages.tsx
 M src/server/portal/authorization.ts
 M src/server/portal/service.ts
 M tests/portal/authorization.test.ts
 M tests/portal/lifecycle.test.ts
?? CONTROLLED_VERIFICATION_REPORT.md
?? prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
?? prisma/migrations/migration_lock.toml
?? src/app/workspace/page.tsx
?? tests/portal/migration-contract.test.ts
?? tests/portal/workspace.test.ts
```

All nine tracked modifications and the other five untracked files predate this
phase. Only `CONTROLLED_VERIFICATION_REPORT.md` was authored in this phase, by
appending evidence; its previous content was retained. The local generated DDL
artifact is ignored. A preservation snapshot covers all 337 other tracked and
nonignored files; final comparison confirmed all 337 are byte-for-byte unchanged.
The original report remains an exact byte prefix of the updated report, and the
appended report passed the whitespace check. Final Git status retained the same
nine modified and six untracked paths. `git diff --check` passed; Git emitted
line-ending warnings and a permission warning for the global ignore file.

No commit, push, pull, branch switch, stash, reset, installation, new service,
deployment, production activation, database connection/write/migration/seed or
destructive cleanup occurred. No fresh GitHub synchronization check was made.


## 14. Disposable PostgreSQL setup plan (read-only assessment, 2026-10-10)

### Findings freshly checked

- Node.js v22.14.0; npm 10.9.2; installed Prisma CLI/client 7.10.0,
  pg 8.23.0, @prisma/adapter-pg 7.10.0, TypeScript 5.9.3.
  Versions were read from local packages; no dependency command installed anything.
- No psql, pg_ctl, postgres or docker command found on PATH. No matching
  PostgreSQL/Docker Windows service was reported. Checked standard PostgreSQL
  and Docker Desktop installation locations are absent. This is a bounded
  inspection, not proof that no portable/custom/remote instance exists.
- No listener on local port 15432 was reported by the local network inventory.
  Recheck immediately before setup; do not treat a silent query as authorization
  or proof that an unknown service is safe.
- Only ordinary .env contains DATABASE_URL among inspected database/gate names.
  Dedicated .env.verification.local and .env.pg-disposable.local are absent;
  inspected process database and activation variables are absent. No value was
  printed. The ordinary endpoint remains UNIDENTIFIED: DO NOT CONNECT.
- No dedicated disposable instance has been established by the inspected
  configuration or tooling. No database connection was used to investigate.
- prisma7.config.ts imports dotenv/config and selects DATABASE_URL.
  src/server/db.ts uses getEnv().DATABASE_URL and a cached Prisma client.
  TEST_DATABASE_URL alone redirects neither. Existing migrate scripts are
  unsuitable for this plan until a fail-closed test binding exists.
- Thirteen ordered migration directories remain present, from
  20260916000100_initial_foundation through
  20261010000500_portal_scope_integrity. The local migration lock specifies
  postgresql and remains untracked. Local text review reconfirmed catalogue and
  backfill writes, custom checks/triggers/partial indexes and NOT VALID checks.
  None is executed or certified by this assessment. All previous SQL findings
  and the detailed migration inventory in section 13 remain applicable.
- Production auth activation flags remain absent in inspected configuration;
  the configured commerce provider remains null. No gate or configuration was
  changed. No deployed production behavior was tested.

### Recommended path

Use approved PostgreSQL 17 Windows x64 portable binaries in a fresh directory
under the current user's LocalAppData. Initialize a brand-new cluster there,
bind only 127.0.0.1:15432, and run it directly with pg_ctl rather than registering
a Windows service. No Docker, WSL, PATH change, firewall opening or remote account
is required by the proposed design. PostgreSQL's official Windows page links
EDB binaries ZIPs as an alternative to the installer:
[Windows binaries](https://www.postgresql.org/download/windows/).

This is the simplest proposed local route given the absent database/container
tools, not a claim that a ZIP is already present or runnable. Select and record
an exact supported 17.x Windows x64 package from that official-linked publisher;
verify provenance and available vendor integrity/signature information before
running binaries. If runtime prerequisites are missing, STOP for separate
approval; do not silently install them. No download or provisioning occurred.

A user-owned disposable remote instance is a fallback, not the recommendation.
A name, URL or "test" label alone is never evidence of ownership/disposability.

### Configuration design (placeholders only; NOT created)

Ignored .env.verification.local, loaded ONLY by a future guarded test launcher:

~~~dotenv
TEST_DATABASE_URL=postgresql://toprank_test_owner:<URL_ENCODED_NEW_TEST_PASSWORD>@127.0.0.1:15432/toprank_verify_<APPROVED_GUID>?schema=public
TOPRANK_TEST_TARGET_ID=<APPROVED_GUID>
TOPRANK_TEST_EXPECTED_HOST=127.0.0.1
TOPRANK_TEST_EXPECTED_PORT=15432
TOPRANK_TEST_EXPECTED_DATABASE=toprank_verify_<APPROVED_GUID>
TOPRANK_TEST_EXPECTED_USER=toprank_test_owner
TOPRANK_TEST_EXPECTED_DATA_DIRECTORY=<ABSOLUTE_NEW_CLUSTER_PATH>
TOPRANK_TEST_WRITES_APPROVED=false
AUTH_RATE_LIMIT_ACTIVATED=false
AUTH_RATE_LIMIT_LIVE_VERIFIED=false
AUTH_TRUSTED_PROXY_VERIFIED=false
~~~

The TOPRANK_TEST_* names above are PROPOSED safeguards, not currently implemented
repository variables. Setting them does not enforce safety today. No real URL
or password belongs in a report, shell argument, transcript or Git. Generate
independent bootstrap/owner passwords locally and enter them at masked prompts.
If a local credential file is used later, restrict its ACL to the current user;
Git ignore is not a confidentiality control.

git check-ignore confirmed .env.verification.local, .env.pg-disposable.local and
.env.pgtest.local are ignored by the repository. The native route does not need
Docker POSTGRES_* variables or .env.pg-disposable.local. Never edit normal .env
or reuse its credentials. Keep cluster data, logs and binaries outside the repo.

### Required safety checks and approval boundaries

1. SETUP approval must explicitly cover downloading/extracting trusted binaries,
   creating a new cluster (initdb writes system databases), starting its local
   process, read-only inspection of that new instance, and conditional creation
   of the test-only owner/database. It does not approve existing targets.
2. Resolve and record the exact fresh root/data path, GUID, version/package
   provenance, port and owner. Require no pre-existing root/data directory,
   no reused volume and no valuable data. Recheck the port. Never resolve a
   placeholder to an existing installation/data directory.
3. Check all inherited PG* defaults/PGSERVICE/PGPASSFILE and application database
   overrides. Use an isolated process and explicit binary/host/port/database/user
   arguments; reject conflicting configuration rather than silently selecting it.
   Disable shell transcript/debug logging around credential handling.
4. Require successful initdb with SCRAM password authentication; inspect the
   generated pg_hba.conf locally for no trust entries. Check process ID,
   executable, command line/data directory, and loopback-only listener ownership
   before permitting even the first connection. If anything differs, STOP.
5. Only then, under setup/read-inspection approval, connect to the newly created
   postgres maintenance database and verify data_directory, server_version,
   current_database, current_user, address and port. Require exact matches.
   Confirm the proposed application database does not exist.
6. Conditional setup writes may now create ONLY the new owner/database. Recheck
   that the test database's non-system application schemas are empty and its
   owner is correct. Stop on any existing application table/type/function,
   migration ledger or unexpected schema. Record non-secret identity evidence.
7. Before any migration/fixture write, implement and review a separate
   fail-closed Prisma/test/application binding under explicit code-change
   approval: parse only the dedicated file; no normal .env fallback; require the
   approved exact host/port/database/user/data-directory identity; reject
   multi-host URLs, alternate sockets/options/schema parameters and mismatches;
   set DATABASE_URL only inside an isolated child when existing application
   code requires it. Identity queries must precede constructing the application
   client or importing modules that initialize it. No shared dev server/client.
   Tests must cover refusal of unknown/production/override targets.
8. A separate, target-specific MIGRATION/TEST approval must authorize chronological
   replay of the 13 migrations and bounded test fixtures on this exact identified
   database. It must acknowledge migrations' own catalogue/backfill writes.
   Keep seed scripts, reset, db push, production routes, payment providers,
   Upstash activation and broad cleanup out of scope. Fixture teardown may touch
   only suite-created records; populated-upgrade cases need separate fixtures.

The existing repository has neither this guarded launcher/config nor a real
PostgreSQL integration harness. They were NOT added in this planning task.
Do not run npm run prisma:deploy, prisma:migrate or db:seed against current config.

### Exact proposed setup commands (NOT executed)

Run in a fresh PowerShell session ONLY after SETUP approval. First acquire a
specific approved ZIP from the official-linked publisher and replace the ZIP
placeholder with its local path. Do not guess a download URL or checksum.

~~~powershell
$ErrorActionPreference = 'Stop'
$Zip = '<ABSOLUTE_PATH_TO_APPROVED_VERIFIED_POSTGRESQL_17_X64_ZIP>'
if (-not (Test-Path -LiteralPath $Zip -PathType Leaf)) { throw 'Approved ZIP missing' }
$Id = [guid]::NewGuid().ToString('N')
$Root = Join-Path $env:LOCALAPPDATA ('TopRankVerify\pg17-' + $Id)
$Data = Join-Path $Root 'data'
$Port = 15432
$Db = 'toprank_verify_' + $Id
$Admin = 'toprank_test_admin'
$Owner = 'toprank_test_owner'
if (Test-Path -LiteralPath $Root) { throw 'Fresh root required' }
$Listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
if ($Listeners | Where-Object { $_.LocalPort -eq $Port }) { throw 'Port in use' }
if (Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' -or $_.Name -in @('DATABASE_URL','TEST_DATABASE_URL') }) { throw 'Conflicting inherited database settings; use an isolated clean session' }
New-Item -ItemType Directory -Path $Root | Out-Null
Expand-Archive -LiteralPath $Zip -DestinationPath $Root
$Bin = Join-Path $Root 'pgsql\bin'
foreach ($Exe in @('initdb','pg_ctl','postgres','psql','createdb')) {
  if (-not (Test-Path -LiteralPath (Join-Path $Bin ($Exe + '.exe')))) { throw 'Unexpected archive layout' }
}
& "$Bin\postgres.exe" --version
if ($LASTEXITCODE -ne 0) { throw 'Binary/runtime check failed' }
# STOP if the verified version is not the approved 17.x package.
& "$Bin\initdb.exe" -D $Data -U $Admin -W -A scram-sha-256 -E UTF8
if ($LASTEXITCODE -ne 0) { throw 'Cluster initialization failed' }
# Inspect generated pg_hba.conf locally; require SCRAM, never trust.
& "$Bin\pg_ctl.exe" -D $Data -l "$Root\server.log" -o "-h 127.0.0.1 -p $Port" -w start
if ($LASTEXITCODE -ne 0) { throw 'Server startup failed' }
& "$Bin\pg_ctl.exe" -D $Data status
if ($LASTEXITCODE -ne 0) { throw 'Server status failed' }
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object LocalAddress,LocalPort,OwningProcess
~~~

STOP here to verify PID/executable/data-directory and loopback-only listener
against the fresh cluster manifest. Do not connect on the basis of port/name
alone. Once those match and setup/read-inspection approval covers this new target:

~~~powershell
& "$Bin\psql.exe" -X -W -h 127.0.0.1 -p $Port -U $Admin -d postgres -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting('data_directory'), current_setting('server_version'); SELECT datname FROM pg_database WHERE datname LIKE 'toprank_verify_%';"
if ($LASTEXITCODE -ne 0) { throw 'Identity query failed' }
~~~

Require exact maintenance database/admin/path/version/address/port matches and
absence of $Db before conditional owner/database writes. Name-prefix inventory
does not establish disposal. After successful manual identity review:

~~~powershell
& "$Bin\psql.exe" -X -W -h 127.0.0.1 -p $Port -U $Admin -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE toprank_test_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
if ($LASTEXITCODE -ne 0) { throw 'Owner creation failed' }
& "$Bin\psql.exe" -X -W -h 127.0.0.1 -p $Port -U $Admin -d postgres -v ON_ERROR_STOP=1 -c '\password toprank_test_owner'
if ($LASTEXITCODE -ne 0) { throw 'Owner password setup failed' }
& "$Bin\createdb.exe" -W -h 127.0.0.1 -p $Port -U $Admin --owner=$Owner --template=template0 --encoding=UTF8 $Db
if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
~~~

After creation, approved read-only checks must verify ownership/identity and
all non-system schemas' emptiness before migration authorization. Configure the
dedicated ignored environment locally, never echo its contents. Do not execute
any migration or test-write command until the guarded launcher exists and the
target-specific second approval is recorded. This plan intentionally provides
no executable default-config migration command.

Optional shutdown after identifying the same owned cluster (future approval;
no deletion, no data-directory reuse):

~~~powershell
& "$Bin\pg_ctl.exe" -D $Data -m fast -w stop
if ($LASTEXITCODE -ne 0) { throw 'Shutdown failed' }
~~~

initdb and direct process control are documented by PostgreSQL:
[initdb](https://www.postgresql.org/docs/17/app-initdb.html),
[pg_ctl](https://www.postgresql.org/docs/17/app-pg-ctl.html).
No Windows service registration or background helper was invoked this phase.

### Exact approval requested before execution

"I approve acquiring the reviewed PostgreSQL 17 Windows x64 portable package
and creating one fresh GUID-named TopRank verification cluster under my
LocalAppData, bound only to 127.0.0.1:15432, without Windows service registration
or changes to ordinary application configuration. I approve initializing that
new cluster, starting it, inspecting its confirmed identity, and conditionally
creating its test-only owner/database only after identity checks pass. I do not
approve access to existing databases, migrations, seeding, integration fixtures,
production auth/payment activation, or deletion."

This setup approval does not replace target-specific migration/testing approval.
Any missing runtime installation needs separate explicit approval. Implementing
the guard/harness also requires separate code-change authorization.

### Current-phase results and Git preservation

Only this section was appended to CONTROLLED_VERIFICATION_REPORT.md. Existing
evidence is retained; no production/integration results are relabelled as current.
No tests, build, validation or SQL commands were run this planning phase.
The first local Node inventory expression had a syntax error and was corrected;
the successful retry used filesystem/package/environment-name inspection only.

Git path inventory remains the nine modified and six untracked paths listed in
section 13. No staging occurred. A new preservation snapshot covers all 337
other tracked/nonignored files and the entire report prefix at phase start.
Final comparisons are recorded in the completion response.

No database connection, migration, seed, installation/download, new service,
cluster/database creation, system configuration change, commit, push or
deployment occurred. No secrets or connection-string values were printed.

## 15. Phase 1 launch scope and foundation execution (2026-10-10)

### Explicit user decisions and approval

The user selected JEE Main + NEET UG; an all-ages product with no arbitrary
adults-only restriction; a free invited pilot with payments disabled; and India
and UAE as named markets. Other Middle Eastern countries were not individually
specified. These are scope decisions, not legal or production readiness approval.

The user explicitly approved acquisition of portable PostgreSQL 17 binaries,
a fresh GUID-named LocalAppData cluster on 127.0.0.1:15432, identity inspection
and conditional test-only owner/database creation. The approval excludes
existing databases, migrations, seeds, fixtures, production activation and any
missing-runtime installation. It does not authorize production or test writes
to an unknown URL.

### Implemented repository foundation

- LAUNCH_FOUNDATION.md records the scope, eight-vertical code map, module
  acceptance checklist, proposed content thresholds, jurisdiction/consent work,
  environment ownership and Phase 1 exit criteria.
- config/environments/{development,verification,staging,production}.env.example
  supplies placeholder-only separate configuration templates. No real secret
  file was created and no ordinary .env was edited.
- verification/postgres-target.ts implements a fail-closed, local-only,
  READ-ONLY EMPTY-TARGET preflight. postgres-preflight.ts exposes offline
  validation and a separately gated --connect mode.
- vitest.postgres.config.ts and tests/postgres-live provide an isolated read-only
  identity smoke suite. The normal suite skips it; missing configuration causes
  the explicit live suite to refuse, not silently skip or fall back.
- tests/foundation/postgres-target.test.ts adds 46 mocked/offline guard checks:
  required fields, overrides, host/port/role/URL options, data-directory/PID,
  loopback process identity, PostgreSQL identity/emptiness, least privilege,
  read-approval refusal, read-only queries, secret-safe failure and connection close.

No signup/login, student UI, existing migration SQL, Prisma schema, staff
provisioning, normal app DB selection or commerce provider was modified.
No production gate was enabled. Invite-only access and legal acceptance/guardian
verification remain actual Phase 2 implementation prerequisites, not features
claimed by this documentation. Existing portal-sharing consent is not assumed
to satisfy legal registration consent.

### Provisioning attempt and blocker

Official PostgreSQL/EDB sources were checked through web research. The machine's
PowerShell Invoke-WebRequest attempt could not connect to the EDB publisher.
The approved require_escalated retry failed DNS resolution for
www.enterprisedb.com. Both attempts were page reads, not database connections.
No package, cluster, database, secret, service or background process was created.
No untrusted mirror, guessed ZIP URL or existing database was used as a fallback.

Provisioning is BLOCKED until the official publisher is reachable from the
machine, or an approved provenance-verified Windows PostgreSQL 17 ZIP is locally
available. Any runtime prerequisite installation needs separate approval.
The future restricted owner also needs an explicitly approved pg_read_all_settings
grant on the fresh cluster for data-directory inspection; no grant was executed.

### Exact checks and current results

```powershell
node node_modules/vitest/vitest.mjs run tests/foundation --no-cache --no-fsModuleCache --configLoader runner
node node_modules/vitest/vitest.mjs run --no-cache --no-fsModuleCache --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate --config prisma7.config.ts
node node_modules/tsx/dist/cli.mjs postgres-preflight.ts
node node_modules/vitest/vitest.mjs run --config vitest.postgres.config.ts --configLoader runner --no-cache --no-fsModuleCache
```

- Focused foundation: exit 0, 46 passed, no live service.
- Full suite: exit 0, 979 passed and 2 skipped; 42 passed files and 2 skipped.
  Skipped suites are live Upstash and live PostgreSQL. Duration 19.89 seconds.
  The extra baseline client-foundation test checks client structure, not PostgreSQL.
- TypeScript: initial check found an ES2020 replaceAll incompatibility; changed
  only the new guard to a compatible path normalization expression. Rerun exit 0.
- Prisma validation: exit 0. No database connection or migration was involved.
- Offline preflight: exit 1, EXPECTED REFUSAL because .env.verification.local is
  absent. Generic output only; zero database connections.
- Explicit PostgreSQL suite: exit 1, EXPECTED FAIL-CLOSED SETUP REFUSAL before
  any test because the dedicated file/target is absent. This is not a live pass.
- No build or authenticated browser acceptance was claimed in this phase.

Actual PostgreSQL checks, migrations, seeds, fixture tests and student acceptance
remain NOT RUN. The new preflight requires a fresh empty schema and therefore
is not a migration runner or a post-migration integration harness. Default Prisma
scripts still select the ordinary URL. A reviewed write-safe launcher and
critical-flow harness remain required under subsequent target-specific approval.

### Legal and product release dependencies

The user expressly requested real Terms/Privacy acceptance and required guardian
verification in registration/onboarding. LAUNCH_FOUNDATION.md defines their
server-side requirements and links official India/UAE references; no policy-only
claim of compliance is made. India commencement/applicability, UAE operating
regime/classification, international processing and other country scope require
qualified review before activation. Live AI and payments remain disabled.
Content thresholds and editorial ownership are proposed, not yet signed off.

### Git and Phase 1 exit

At phase start, all 15 pre-existing changes from sections 13/14 were STAGED by
the user: six added files and nine modified files. Their staged state was
preserved; no staging, commit, push, pull or branch operation occurred here.
This phase adds 11 untracked foundation files and appends this report, making
the report staged-plus-unstaged (AM). Final full path inventory is available via
git status --short --untracked-files=all and is included in the completion report.

Phase 1 is PARTIALLY COMPLETE: launch scope/mapping/configuration/guard tests are
implemented; actual disposable infrastructure and owner acceptance remain blocked.
No existing database connection, migration, seed, production activation,
installation, deployment or system configuration change occurred. Earlier
verification evidence remains intact. Do not mark infrastructure or launch ready.

Final checks: git diff --name-only lists only this report; none of the existing
staged code/migration/doc changes was edited. The entire staged prior report
remains the prefix of the working report (accounting for Git line-ending
normalization). Whitespace checks passed, and dedicated local secret filenames
remain ignored. Git still warns about permission to read the global ignore file.

Final path inventory (M/A in the first column are pre-existing staged changes;
AM means this report also has the new unstaged appendix):

```text
AM CONTROLLED_VERIFICATION_REPORT.md
M  MASTER_BUILD_STATUS.md
M  PORTALS_CONSENT_TENANTS.md
A  prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
A  prisma/migrations/migration_lock.toml
M  src/app/[[...path]]/page.tsx
A  src/app/workspace/page.tsx
M  src/components/portal/PortalWorkspace.tsx
M  src/screens/AuthPages.tsx
M  src/server/portal/authorization.ts
M  src/server/portal/service.ts
M  tests/portal/authorization.test.ts
M  tests/portal/lifecycle.test.ts
A  tests/portal/migration-contract.test.ts
A  tests/portal/workspace.test.ts
?? LAUNCH_FOUNDATION.md
?? config/environments/development.env.example
?? config/environments/production.env.example
?? config/environments/staging.env.example
?? config/environments/verification.env.example
?? postgres-preflight.ts
?? tests/foundation/postgres-target.test.ts
?? tests/postgres-live/identity.pg.test.ts
?? tests/postgres-live/read-only.setup.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
```

## 16. Phase 2 student accounts and onboarding (2026-10-10)

Implemented STUDENT-only atomic signup with explicit versioned terms/privacy
acceptance, pre-registration guardian authorization, current-consent session
guards, withdrawal/revocation and reviewed adulthood transition. Added encrypted
queued recovery, bounded operator-triggered email delivery and single-use reset
with session revocation. Existing exam/goal/preferences journey is reused and
the profile-update completion shortcut is rejected. New accounts migration is
NOT APPLIED. Prior portal, Phase 1 and disposable-target evidence is preserved.

Verification: focused auth/student/portal 572 passed/1 skipped; full suite 1,037
passed/2 skipped. TypeScript and Prisma validation/generation passed. Isolated
Next build passed after normal build encountered the existing preview log lock.
Seven anonymous account/legal pages returned HTTP 200. No forms were submitted.
Browser/mobile acceptance is unavailable (empty browser inventory). Persistence
and external delivery are mocked, not real PostgreSQL or provider verification.

Safe configuration inspection confirmed AUTH_RATE_LIMIT_ACTIVATED,
ACCOUNT_POLICY_REVIEWED, ACCOUNT_GUARDIAN_VERIFICATION_APPROVED and
AUTH_RECOVERY_DELIVERY_VERIFIED are disabled. Consent HMAC and recovery encryption
keys, sender and provider key are absent. Commerce configuration still returns
no provider. No secrets were printed or configuration values changed.

No database connection, migration/seed, installation, production activation,
commit/push/deploy or destructive cleanup occurred. Under-18 authorization is a
conservative pilot policy, not a legal sign-off. Approved manual verification,
legal/operator prerequisites, live email, disposable PostgreSQL migration and
authenticated end-to-end tests remain release gates. See
STUDENT_ACCOUNTS_ONBOARDING.md for commands, configuration and limitations.

## 17. Phase 3 exam catalogue and learning (2026-10-10)

Implemented catalogue/saved-resource navigation, structured lesson delivery,
draft-only authoring/import, revision-bound independent review, shared publication
gates and bounded coverage reporting. Lesson progress checks entitlement; ambiguous
unscoped slugs are rejected. Production views no longer show invented progress.

Latest full suite: 1,119 passed/2 skipped. Focused content/student/auth/portal:
668 passed/1 skipped. TypeScript, Prisma generation/validation, isolated build and
whitespace checks passed. TSX rendering tests now execute. New learning migration
NOT APPLIED. Persistence, serializable review/publication and rollback are mocked.

32 original starter records include 8 structured draft lessons and 8 recap
resources; NONE were human-reviewed, imported or published. No licensed reviewed
launch corpus or approved coverage matrix was supplied. Anonymous protected
routes redirect/deny; browser inventory is empty. Production auth/policy/guardian/
recovery flags remain disabled and commerce has no configured provider.

A narrow ignore exception includes the coverage source endpoint. Next generated
type includes are retained; next-env.d.ts default imports restored. Prior index
entries and user work are preserved. No database connection, migration/seed,
installation, production activation, commit/push or deployment occurred.
Phase 3 release exit NOT VERIFIED. See EXAM_CATALOGUE_LEARNING.md for commands,
operation sequence, regression evidence and remaining gates.

## 18. Content & Knowledge Studio: first coherent increment (2026-10-10)

Reused the existing authoring/publication/student content/scoring architecture.
Added syllabus version governance, separately recorded source/licence verification,
bounded JSON preview/confirmation, answer-free question browsing, minimal audit
history and provider-neutral blocked SIA refresh requests. No ingestion worker or
provider is configured; no success is reported. New migration .008 is NOT APPLIED.
Future editorial publication requires independently verified current source/licence
metadata. Reviewed/published content is protected from in-place authoring edits.

Focused unit checks: 353 passed. Full unit suite: 1,173 passed/2 skipped.
TypeScript, Prisma generation/validation and isolated Next production build passed.
Whitespace checks passed. Anonymous loopback Studio page: 307; Studio/question APIs
and POST import preview: 401. GET import preview: 405 as that route is POST-only.
No authenticated browser acceptance or PostgreSQL persistence was verified.

Production activation checks remain false; commerce and knowledge adapter factories
return null. No database connection, migration, seed, import execution, installation,
commit, push or deployment occurred. Existing 15 index entries remain untouched.
Partial features and the complete dirty-tree inventory are documented in
CONTENT_KNOWLEDGE_STUDIO.md. This does not certify a student-ready content library.

## 19. Phase 4 daily study command centre (2026-10-11)

Existing missions/plans/sessions reused. Added date-aware Today/Week/Overdue views,
distinct bounded weekly previews including reviewed practice, validated canonical
task planning, daily-budget protection, active task ownership/version enforcement,
stable completion timestamps, optional owned mission/session linkage and revision
capacity selection. Existing progress/scoring/protected-answer behavior retained.
New Phase 4 migration is NOT APPLIED; partial unique indexes intentionally abort
on legacy overlapping sessions/plans rather than modifying user data.

Focused unit checks: 614 passed/1 skipped. Full suite: 1,209 passed/2 skipped.
TypeScript, Prisma generation/validation, isolated optimized build and whitespace
checks pass. Persistence, concurrency and migration behavior are NOT live-verified.
Anonymous loopback preview boundaries deny/redirect; authenticated desktop/mobile
student acceptance remains pending. No reviewed launch content was supplied.

Production gates remain disabled. No database connection, migration, seed/import,
installation, staging, commit/push or deployment occurred. Existing index/work
preserved. See DAILY_STUDY_COMMAND_CENTRE.md for exact commands, limitations,
remaining release gates and the current Git inventory.

## 20. Phase 5 practice and Mistake-to-Mastery code verification

Added immutable question authoring/successors using canonical Question/Option/Exam
and existing editorial, source and audit records. Independent question, explanation,
answer/scoring and source/rights evidence is required before future publication.
Older publication endpoints can no longer manufacture REVIEWED or alter scoring.
Student question lists omit unscored links. Practice revision uses owner-bound
latest attempts and bookmark/review records; review never declares mastery.
Frozen results, decimal scoring and protected mock snapshots were retained.
Added cursor-based history and owner-scoped tab-local uncertain-request recovery.

Focused: 770 passed/1 skipped. Full: 1,276 passed/2 gated live tests skipped.
TypeScript, offline Prisma generation/validation, isolated optimized Next build,
and git whitespace checks passed. New migration NOT APPLIED. All persistence,
retry and concurrency assertions are mocked; SQL contract tests are not PostgreSQL
execution. Anonymous preview on 127.0.0.1:3011 denies APIs (401) and redirects
protected pages (307). Authenticated desktop/mobile acceptance remains unverified.

No database/provider connection, migration, seed/import, content publication,
installation, production activation, staging, commit/push or deployment occurred.
Local/process activation gates were checked as disabled without printing values.
Commerce provider factory remains disabled. Deployed configuration was not inspected.
Legacy question provenance and an actual licensed/reviewed library remain launch
requirements. Existing staged/untracked work was preserved. See
PRACTICE_MISTAKE_TO_MASTERY.md for exact commands, limits and Git inventory.

## 21. Phase 6 timed mock exams code verification (2026-10-11)

Canonical MockExam/MockAttempt/MockAnswer, immutable snapshots, server scoring,
serializable bounded retries, answer version checks and finalization CAS retained.
Added independent blueprint review through existing ContentEditorialRecord and
AuditEvent; current version and fingerprint required before publication/new start.
Edits clear review. Lifecycle publication keeps unchanged reviewed content valid.
Existing attempt resume/finalization does not require retroactive blueprint review.

Student workspace now debounces autosave, preserves one owned tab-local pending
answer/version, reconciles lost acknowledgments, pauses stale-version conflicts,
and reconciles reconnect/visibility/expiry through authenticated server reads.
Clock display handles suspend/backward wall time; local expiry never manually
submits. Finalized explanation review is withheld for NEVER policy and active
attempts. Numerical keys and correctness flags are not added to public questions.

Focused checks: 611 passed. Full suite: 1,305 passed/2 gated tests skipped.
TypeScript, offline Prisma validate/generate, isolated optimized build (62 static
generation entries), and whitespace checks passed. Anonymous preview at
127.0.0.1:3012: three private GET APIs and POST mock submission return 401; three
protected pages return 307. SSR shell tests are not authenticated browser acceptance.
No live PostgreSQL persistence, locking, migrations or disconnect testing claimed.

No database/provider access, migration, seed/import, publication, installation,
staging, commit/push, deployment or activation occurred. Existing 15 staged paths
preserved. Local/process activation gates remain disabled; deployed configuration
not inspected. Payment provider factory remains null. Build added generated Phase 6
type paths to tsconfig and updated generated next-env references; prior tsconfig
includes and unrelated work retained.
No new schema/migration required; existing unapplied editorial dependency remains.
See TIMED_MOCK_EXAMS_PHASE6.md for bounded recovery, legacy blueprint handling,
release gates, final Git inventory and proposed commit/push commands.

## 22. Phase 7 progress, digital profile and SIA (2026-10-11)

Private progress now consolidates existing canonical counts with timezone-aware
28-day evidence: weekly mission/lesson completions, session minutes, practice
submission accuracy and unique questions, finalized mock aggregates, subject
practice and recent timeline. All evidence queries use authenticated ownership.
Protected practice answers and mock snapshots are not selected; mock result JSON
is explicitly reduced to validated scalar aggregates. Invalid results are excluded
with a warning. Large periods are bounded and labeled potentially incomplete.

SIA remains deterministic: checks due mission publication/current exam and lesson
entitlements, skips stale links, uses available pending practice/mock revision,
does not prematurely recommend future missions, and offers accessible unfinished
lessons or reviewed practice. Competition suggestions only link to eligibility
review. No live AI/provider or knowledge-indexing success is claimed.

Focused regression: 715 passed. Full suite: 1,384 passed/2 gated tests skipped.
TypeScript, offline Prisma validate/generate, isolated optimized Next build (62
static-generation entries), and whitespace checks PASS. SSR tests cover rendering,
escaped names, empty/truncated evidence and links, not browser acceptance. Persistence,
ownership queries and entitlement availability assertions are mocked, not PostgreSQL.

Loopback preview 127.0.0.1:3013: anonymous progress/SIA GETs return 401 (including
forged ownership query); /progress and /get-help return 307. No authenticated request,
signup/login, health/DB endpoint, provider call, database connection or migration.
No Phase 7 schema change. Existing index's 15 paths and prior work preserved.
No install, seed/import, content publication, activation, commit/push or deploy.
Local/process activation flags checked disabled; deployed configuration not inspected.
Generated Next type references updated for Phase 7; prior tsconfig includes retained.
Production authentication/payment gates remain disabled. See
PROGRESS_DIGITAL_PROFILE_SIA.md for evidence limits, release gates and Git commands.

## 23. Phase 8 competitions, support and partnerships (2026-10-11)

Independent mock review is now required for new competition publication. Explicit
result verification is persisted only through completed server settlement after
the entry window/all attempts finalize. Student completed-result refresh is read-only.
Overall ranks/placement sharing exclude unverified historical rows; cancellation
withdraws rankings and share links. Existing server scoring and privacy opt-in remain.

Support responses use strict versioned CAS and identical-payload retry safety.
Response, generic in-app notice and minimal audit share a transaction. Owner-only
inbox reuses CommerceNotification with unread/paging/read controls, no external
delivery. Guardian decisions notify both parties with no private evidence; existing
dual acceptance, expiry, narrowing and revocation controls retained. School/teacher
expansion is not part of the free invited student pilot.

Focused 729 passed; full 1,461 passed/2 gated tests skipped (77 added). TypeScript,
offline Prisma validate/generate, isolated optimized Next build (63 generation
entries) and whitespace PASS. Persistence/concurrency/CAS are mocked; SQL contract
and initial SSR rendering do not verify PostgreSQL or authenticated browser UX.
New forward-only engagement migration NOT APPLIED; prior dependencies unchanged.

Anonymous loopback 127.0.0.1:3014: notifications (including forged identity), help,
competitions, admin help, portal GET and notification POST return 401; protected
support/competition/achievement/parent/consent pages return 307. No DB/health,
authenticated mutation, signup/login or provider endpoint exercised.

No database, migration, seed/import, content publication, dependency install,
production activation, staging, commit/push or deploy. Original 15 staged paths
preserved. Local/process auth/consent/recovery gates disabled, payment/knowledge
provider factories null; deployed settings not inspected. Real PostgreSQL/browser,
reviewed content, safeguarding/support operations and jurisdictional guardian/legal
approval remain release gates. Railway ingress/live Upstash still unresolved.
See COMPETITIONS_SUPPORT_PARTNERSHIPS_PHASE8.md for exact commands, limits and Git.

## 24. Phase 9 commerce and operational completion (2026-10-13)

Free invited pilot package price zero is supported only with ONCE fixed duration;
strictly positive money and immutable financial constraints remain. Administrator
bundle grants use active STUDENT targets, server package features/expiry, atomic
canonical entitlements/audit/generic in-app notice and immutable original intent.
Replay cannot extend or resurrect withdrawn access; changed/partial intent conflicts.
New purchase access requires an owned CAPTURED order, excluding confirmed refunds.

Private /admin/operations exposes sampled queue counts, paginated grant/window
administration and filtered audit summaries without actor/private detail. Configuration
flags are not external acceptance evidence. Paid provider-dependent actions disabled.
Monitoring, backup/restore, deployment and recovery runbook prepared only; no services,
schedules, archives, restoration, domain or infrastructure were configured.

Focused 744 passed (43 files); full 1,555 passed/2 gated live tests skipped
(79 passing files/2 skipped; 94 added). TypeScript, offline Prisma validate/generate,
isolated optimized Next build (64 generation entries) and whitespace PASS. New
20261013000100_free_pilot_packages forward CHECK migration CREATED, NOT APPLIED.
No historical migrations or Prisma models/fields changed. Persistence, serial retries,
group rollback and notices are mocked; SQL/SSR checks are not PostgreSQL/browser tests.

Anonymous loopback 127.0.0.1:3015 operations/access/audit/admin/student-commerce GET
and pilotGrant POST return 401; admin operations/commerce and packages pages 307;
process-only /api/live 200. No authenticated mutation, signup/login, DB health or
provider endpoint used. No database, migration/seed/import, dependency installation,
publication, backup/restore, production activation, staging, commit/push or deploy.
Original 15 staged paths preserved. Local/process auth/consent/recovery gates disabled;
payment/knowledge factories null. Deployed configuration and recovery/monitor evidence
not inspected. Reviewed content, legal/guardian, real DB/browser, operational ownership
and trusted-ingress/live Upstash remain release gates. See
COMMERCE_OPERATIONAL_COMPLETION_PHASE9.md and LAUNCH_OPERATIONS_RUNBOOK.md.

## 25. Phase 10 verification: INCOMPLETE / release BLOCKED (2026-10-13)

Fresh explicitly offline suite 1,555 passed/2 gated live tests skipped, TypeScript,
offline Prisma schema validation and isolated optimized build (64 generation entries)
PASS. Source is the dirty working tree, not HEAD/deployed revision alone. No product
failure reproduced in available checks; no assertion that critical blockers are absent.

Dedicated PostgreSQL config missing, offline preflight refused before connecting;
normal URL has loopback pattern but unknown identity. Railway config/CLI 5.44.1 present,
metadata authentication unavailable. No Railway database/dedicated environment or
applied migration history verified. All 20 SQL files unexecuted here. Existing live
database harness is empty-target identity only, not migration/critical-flow coverage.
Browser surfaces/IAB unavailable, Playwright/axe absent. Upstash test credentials/
identity missing. No credentials, URL values or fingerprint printed; no further question.

Loopback 127.0.0.1:3016 preview uses unreachable placeholder datasource, not normal
configuration. Private student/admin/portal GETs 401; protected pages 307; liveness 200;
empty disabled payment webhook 503/sanitized. No auth submission, DB health, external
provider or authenticated data write. These smoke/SSR/mock checks are not complete
journey, mobile/accessibility/performance, PostgreSQL/concurrency or recovery evidence.

No DB, migration, seed/import/fixture, install, cloud provisioning, CLI login/link,
production activation, stage/commit/push/deploy. Original 15 staged paths preserved.
No code/schema permission or target guard relaxed. Isolated verification selector and
generated Next type references added; previous includes/default output retained.
Real approved target/migrations/flows, authenticated browser, trusted ingress/live auth,
guardian/legal/content and operational/backup restore gates remain release blockers.
See FULL_PRODUCT_VERIFICATION_PHASE10.md for matrix, commands, limits and Git inventory.

## 26. Phase 11 controlled student pilot: NOT STARTED (2026-10-13)

Fresh secret-suppressed read-only Railway metadata still cannot authenticate; dedicated
verification config missing and local auth/limiter/ingress/policy/guardian/recovery
flags disabled. No target-specific deployment/artifact/cohort approval or completed
Phase 10 release evidence verified. No existing hosted database assumed disposable.

Prepared a go/no-go pilot protocol with proposed five voluntary students/seven days,
approved content/consent boundaries, measurement denominators, actual-claim checklist,
incident/retest/recovery and explicit completion/public-launch sign-off. Proposals
are NOT approved enrollment, measured outcomes, stable-pilot or release approval.

Documentation only; no product source, guard, schema, migration, dependency or flag
changed. No tests/build rerun: prior 1,555 passing offline tests/2 live skips are Phase
10 evidence, not a student pilot. No database connection/write, deployment, invitation,
account provisioning, contact export, installer, cloud resource, activation, stage,
commit/push or recovery drill. Original 15 staged paths retained. Pilot exit NOT MET;
Phase 10 real-database/browser/security/recovery, content/legal and operations gates
remain. See CONTROLLED_STUDENT_PILOT_PHASE11.md for protocol and Git evidence.

## 27. Phase 1 foundation refresh / Phase 12 NOT STARTED (2026-10-13)

Latest instruction starts at Phase 1, not immediate public activation. Retained
previously approved exams/audience/India-UAE/free-pilot scope; mapped canonical
modules in eight verticals to actual required acceptance and subsequent build reports.
Marked initial foundation inventory as historical rather than silently erasing it.
Source/lockfile/Prisma config/four environment planning templates present. Dedicated
database config missing; offline preflight expected refusal before any connection.
Inspected local auth/limiter/ingress/policy/guardian/recovery flags disabled, payment
and knowledge factories null. No values/credentials/target fingerprints exposed.

No test/build rerun for this documentation-only refresh. Phase 10's 1,555 passing
offline tests/2 live skips are prior evidence, not new PostgreSQL or launch acceptance.
No code, schema/migration, test, dependency, environment or permission changed. No
database/write, installer, resource, invitation, publication, deployment, production
activation, stage/commit/push. Original 15 staged paths preserved. Foundation safe-DB
exit remains blocked; Phase 10 incomplete, Phase 11 not started, Phase 12 not approved.
See LAUNCH_PROGRAMME_PHASE1_REFRESH.md for scope, current map and Git evidence.

