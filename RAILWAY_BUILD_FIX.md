# Railway production build fix

Date: 2026-11-07 (Asia/Calcutta). Local fix verified; NOT redeployed.

## Cause and evidence

Read-only Railway CLI access succeeded using the user's existing authorization.
The linked service has NODE_ENV=development while executing next build/start.
Required database/application configuration was checked for presence/basic shape
without printing secrets. Authentication activation/ingress/policy/recovery approval
flags were absent. No Railway variables, settings or deployment were changed.

The latest failed Railway build logs confirm successful Prisma generation,
compilation and TypeScript, then a worker exit during page-data collection. They
also contain Next's non-standard NODE_ENV warning but no underlying stack trace.

Local reproduction with the same inherited development mode compiled and checked
types, then failed prerendering /_global-error and /guardian-registration with
TypeError: Cannot read properties of null (reading 'useContext'), followed by the
same build-worker exit. The precise remote stack remains unavailable; this is a
confirmed configuration defect and a locally reproduced failure mechanism, not a
claim that an unpublished remote stack was observed.

The first sandbox-only reproduction stopped earlier because Google Fonts downloads
were blocked. Repeating with network access for the existing fonts exposed the
React/prerender failure. No font, dependency or UI replacement was necessary.

## Changes

- package.json: build/start call node scripts/production.mjs build/start.
- scripts/production.mjs: supplies NODE_ENV=production BEFORE Prisma or Next loads
  dotenv/React, independently of the inherited Railway value. Uses existing local
  CLIs through process.execPath, no POSIX-only inline environment assignment or new
  dependency. Build still generates Prisma before Next; start still binds 0.0.0.0
  and retains Railway PORT. Child failures propagate; SIGINT/SIGTERM are forwarded.
- tests/foundation/production-command.test.ts: 13 regressions cover inherited
  missing/development/test/staging/production environments, build order, start mode,
  environment preservation, unchanged security flags, failure short-circuiting,
  unknown commands and package-script wiring. Child processes are mocked here.
- Local next dev is unchanged. No migrations, seeds, imports, installs, schema
  changes, authentication bypasses or live provider activation were introduced.

Setting NODE_ENV inside next.config.ts would be too late for modules already loaded
by the CLI. Both build and runtime need the production setting; fixing only build
would leave a development-mode server and could weaken environment-dependent guards.

## Verification

| Check | Actual result |
| --- | --- |
| Direct old next build with NODE_ENV=development, inert DB, existing fonts available | FAIL reproduced: React useContext prerender error and worker exit 1 |
| Fixed npm.cmd run build, STILL inheriting NODE_ENV=development | PASS: no NODE_ENV warning; Prisma generation, TypeScript, page-data collection and 66 generation entries |
| node node_modules/vitest/vitest.mjs run tests/foundation/production-command.test.ts | PASS: 13 tests |
| Full offline Vitest suite, command below | PASS: 1,674 passed, two gated live tests skipped; 84 test files passed |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | PASS |
| Local production startup via the new launcher, inherited development mode | HTTP assertions passed: /api/live 200, /api/auth/readiness 503, POST /api/auth/login 503 AUTH_UNAVAILABLE |
| Temporary smoke-server cleanup | Initial sandbox cleanup was denied, so the orchestration command exited 1 AFTER HTTP assertions; scoped elevated cleanup stopped the three verified smoke-test processes |

The smoke server used an ephemeral loopback port, synthetic credentials and an
inert DB address, not the Railway deployment or an existing database. No successful
database connection, authentication, session creation or provider call was tested.
The temporary server was stopped; no persistent service was installed or started.

Exact fixed build verification (PowerShell; child-process variables only):

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/offline_build'
$env:APP_URL = 'https://toprank.example'
$env:AUTH_SECRET = 'local-build-verification-only'
$env:TOPRANK_VERIFY_BUILD = 'accounts'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:AUTH_RATE_LIMIT_ACTIVATED = 'false'
$env:AUTH_TRUSTED_PROXY_VERIFIED = 'false'
$env:ACCOUNT_POLICY_REVIEWED = 'false'
$env:ACCOUNT_GUARDIAN_VERIFICATION_APPROVED = 'false'
$env:ACCOUNT_PRIVACY_PROCESSING_APPROVED = 'false'
$env:AUTH_RECOVERY_DELIVERY_VERIFIED = 'false'
npm.cmd run build
```

This used the existing isolated .next/accounts-verification output, not a deployed
artifact. Execute these diagnostic assignments only in a temporary verification
shell, never as production Railway configuration. No .env file was changed.

```powershell
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run'],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',RUN_UPSTASH_LIVE_TESTS:'false',TOPRANK_POSTGRES_READ_SUITE:'false',DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1:1/offline_build'}});process.exit(r.status??1)"
```

## Remaining deployment steps and limits

No commit, push, redeployment, Railway variable mutation, database operation or
dependency installation occurred. The repository fix must reach Railway through
an approved commit/push/redeploy before claiming the remote build is repaired.
The remote NODE_ENV variable is unchanged; these production commands override it
for their child processes. A separately approved configuration cleanup can set the
service variable to production or remove it. Do not enable authentication to fix a build.

The npm production-config warning and Railway config-as-code deprecation are not
the worker-crash cause. No automated config migration was run. Railway's install
log also reported dependency vulnerabilities; dependency remediation is separate
work and was not silently attempted with npm audit fix or package upgrades.
Earlier database migration, content, legal and live-provider release gates remain
open. Build success is not authorization for public launch.

Sources: https://nextjs.org/docs/messages/non-standard-node-env and the installed
Next 16.3.5 environment-variable guide/CLI source; read-only Railway build logs and
configuration-presence checks. No credentials or connection strings were recorded.

## Commit and push commands (not executed)

Initial working tree was clean. Only the following four files belong to this fix.
Review staged changes. A push may trigger Railway production redeployment; run it
only when that deployment is approved.

```powershell
git add -- package.json scripts/production.mjs tests/foundation/production-command.test.ts RAILWAY_BUILD_FIX.md
git diff --cached --check
git diff --cached
git commit -m "Fix Railway production build and start environment"
# Only after approving Railway redeployment:
# git push origin main
```
