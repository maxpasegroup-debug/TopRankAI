# Authentication hardening (Phases 1D-1E.2)

## Public mutations

Signup, login and POST logout verify the source against APP_URL's exact origin
(scheme, hostname and port). In production APP_URL must be explicitly configured
with HTTPS. Request URL is a development/test fallback only. Forwarding headers
are not trusted. Origin takes precedence over Referer; invalid/null Origin cannot
fall back to Referer. Missing Origin requires a same-origin Referer. Missing both
is rejected (403), including scripts: API clients must send an approved Origin.
Cross-site Fetch Metadata is rejected as defense in depth. These browser headers
are CSRF defenses, not bot authentication or trusted rate-limit identities.

Logout GET returns 405 and never touches cookies or sessions. POST preserves
hashed-token revocation and cookie clearing. HTML form success redirects with 303.
The existing Settings form already uses POST. Signup has no role selector and
continues to default to STUDENT on the server; manipulated roles remain rejected.

## Request bounds

Signup/login accept application/json (optional charset), no compressed body, and
at most 4096 UTF-8 bytes. Content-Length is an early rejection hint only; actual
streamed bytes are counted before parsing, including chunked/misreported bodies.
Oversize is 413, unsupported formats 415, malformed JSON/UTF-8/input 400. Errors
use the existing API envelope and never echo request bodies or adapter errors.
These are App Router Web Request handlers, not Pages Router bodyParser settings.
Ingress must additionally enforce size, read-timeout and connection/concurrency
limits; application byte limits do not stop slow clients or upstream buffering.

## Provider decision and activation blocker

Selected transport: managed Upstash Redis over TLS REST, using native fetch
without a new dependency. It supports Redis scripting.
It requires an account, database and plan selection; request/command usage and
readiness probes may incur charges. Verify current pricing and set a spending
cap before approving setup. No account, infrastructure or package has been
created. The transport is implemented; no identified sandbox or Redis
configuration is present in the inspected local/process environment.

The provider-neutral Lua adapter is unchanged. The new Upstash executor uses
that same interface and algorithm. The configured runtime factory requires
explicit activation, prior live verification, complete configuration and trusted
ingress attestation. It is currently null. Production (and unknown NODE_ENV)
signup/login still fail closed with 503. Credentials alone cannot activate it.
Inactive development/test retains valid signup/login with NO runtime rate
limiting. Explicitly activated but invalid configuration fails closed there too.

## Atomic budgets and privacy

1. Before reading the body, consume an action-specific global budget with EVAL.
2. After bounded JSON/schema validation, but before password/database work, consume
   client and account/client pair budgets together in one atomic EVAL.

All instances must share the same provider, namespace, secret and configuration.
The Lua script checks every bucket before incrementing, sets PEXPIRE on first
use, and returns the maximum remaining PTTL among exhausted buckets. Denied
requests do not increment counters or extend expiry. Failed login/duplicate
signup attempts count; success does not reset counters. The first global
reservation is not refunded if parsing, identity checks or persistence fail.
No account-wide budget exists: one attacking network cannot lock a victim out
across all networks. Client limits constrain account rotation. Global limits
bound identity-key creation through the route flow; executor callers must keep
both phases. TTL bounds retained keys; global throughput also bounds cardinality.

Fixed windows start with the first request. They allow bursts around expiry;
ingress concurrency/traffic controls remain necessary. Global and shared-NAT
client saturation can deny legitimate traffic; tune budgets from measured load.
All script keys use the namespace as a Redis Cluster hash tag. Do not use
evicting storage for security counters: evictions would reset protection. Verify
provider consistency, no-eviction guarantees and script permissions before use.
Lua atomic execution is not rollback: a script/write failure is treated as
unavailable, even if partial counters were written. Never retry ambiguous writes.

Accounts are trimmed/lowercased, matching existing email casing semantics, then
HMAC-SHA256 keyed with AUTH_RATE_LIMIT_KEY_SECRET. Keys never include raw email,
IP, passwords, tokens or the HMAC secret. No dot/plus-alias folding is performed;
the existing account contract treats these as distinct addresses. IPv4-mapped
IPv6 is unified with IPv4; IPv6 privacy addresses share a /64. Client and pair
digests use distinct domains. Do not log identities, keys or executor errors.
HMAC identifiers are pseudonymous, not anonymous. TTL limits retention; secret
rotation changes budgets, so coordinate across instances without resetting limits
during an incident. Namespace isolates deployments, not individual instances.

## Configuration

Required core configuration (names only; no values in version control):
- AUTH_RATE_LIMIT_NAMESPACE
- AUTH_RATE_LIMIT_KEY_SECRET (random secret of at least 32 bytes, separate from auth)
- AUTH_TRUSTED_CLIENT_HEADER (only the reserved x-toprank-client-ip is supported)
- AUTH_TRUSTED_PROXY_VERIFIED (operator attestation, not automatic verification)
- APP_URL (explicit HTTPS canonical application URL in production)

Optional budget configuration; windows are seconds:

| Budget | Signup default | Login default | Variable pattern |
| --- | --- | --- | --- |
| Global | 100 / 60s | 1000 / 60s | AUTH_SIGNUP_GLOBAL_LIMIT / AUTH_SIGNUP_GLOBAL_WINDOW_SECONDS; AUTH_LOGIN equivalents |
| Client | 10 / 900s | 60 / 900s | AUTH_SIGNUP_CLIENT_LIMIT / AUTH_SIGNUP_CLIENT_WINDOW_SECONDS; AUTH_LOGIN equivalents |
| Account/client | 3 / 900s | 10 / 900s | AUTH_SIGNUP_ACCOUNT_CLIENT_LIMIT / AUTH_SIGNUP_ACCOUNT_CLIENT_WINDOW_SECONDS; AUTH_LOGIN equivalents |

AUTH_RATE_LIMIT_TIMEOUT_MS defaults to 1500, maximum 1800. All limits/windows
are positive bounded integers; invalid supplied values fail configuration.
Server-only transport variables: UPSTASH_REDIS_REST_URL and
UPSTASH_REDIS_REST_TOKEN. Never configure credentials
in NEXT_PUBLIC variables. Use a least-privilege token with required EVAL commands.

AUTH_RATE_LIMIT_LIVE_VERIFIED and AUTH_RATE_LIMIT_ACTIVATED must each be explicitly
true before runtime wiring is possible. These are operator attestations, not
proof of integration; do not set them based on mocked tests or sandbox success
alone. Do not activate production as part of sandbox verification. Restart the
application after separately authorized configuration changes (wiring is at
module initialization). No environment values were changed in Phase 1E.2.

## Upstash REST contract

The executor sends one POST to the canonical HTTPS REST origin with Bearer
authentication in a header. Its JSON body is ["EVAL", script, numkeys, keys...,
args...], following Redis argument ordering. No pipeline is used. Per Upstash,
HTTP 200 success has a single result field; command errors have an error field
and invalid authentication returns 401. The executor rejects all non-200
responses, error/mixed/extra envelopes and non-JSON content, and never echoes
provider bodies. Limiter script results must be the exact integer pairs [1, 0]
or [0, positive bounded milliseconds]. Both executor and Redis core validate.

Only https://<database-host>.upstash.io origins are accepted. No userinfo, custom
ports, paths, queries, fragments, alternative domains or redirects are permitted.
The token is never placed in a URL, output or error. Responses are capped at
4096 actual bytes (Content-Length is only an early check). A deadline spans fetch
and response streaming; cancellation aborts fetch and cancels the reader. There
are no application retries, including after ambiguous writes or authentication
failures. All failures use a generic error without a retained cause.

Official format reference: https://upstash.com/docs/redis/features/restapi

## Trusted ingress contract

No automatic Railway/X-Forwarded-For trust is assumed. Before attesting ingress,
verify that it strips ALL caller-supplied x-toprank-client-ip values, inserts one
validated client IP from its trusted connection metadata, and prevents direct
origin access that bypasses this policy. Arbitrary forwarded headers are ignored;
missing, malformed or multiple reserved IP values return controlled 503 once
the limiter is wired. Merely setting the attestation variable is not sufficient
security evidence. Railway's actual proxy contract remains unverified; if it
cannot meet this policy, select and approve a trusted gateway before activation.

## Failure and readiness

Exhausted budgets return 429 RATE_LIMITED with ceil(remaining PTTL / 1000) in
Retry-After. Missing adapters, invalid configuration/identities, exceptions,
timeouts or malformed Redis results return sanitized 503 with no auth database
work. No cached allow decision or process-local fallback exists. The Redis core
aborts the operation signal at timeout; the TLS transport cancels fetch and
response work via that signal. No ambiguous EVAL retries.
The existing outer decision deadline remains two seconds.

The configured factory requires a fresh successful readiness probe before EVERY
consume. No healthy state or allow decision is cached; recovery requires a fresh
probe. It divides the configured logical decision deadline equally between probe
and consume (default 750ms each), so both fit the outer two-second deadline. The
standalone sandbox transport/core uses 1500ms per operation. Probe traffic adds
command usage to every auth phase; measure latency and Free-plan usage before
activation. If a probe succeeds but consume fails, authentication still fails.

GET /api/auth/readiness returns no-store 200 only after a positive adapter
write/read/TTL script probe and required origin/ingress configuration checks.
Otherwise it returns generic 503 without provider details or credentials. The
probe uses one fixed five-second TTL key, not an auth budget. Probe success does
not attest ingress correctness or guarantee future requests; every auth request
still requires live permission. Existing database health endpoint is unchanged.
Rate-limit readiness probes at ingress and poll at a controlled interval to avoid
unbounded probe costs. Monitor aggregate 429/503, latency, usage, eviction/OOM,
provider errors and probe failures without logging identifiers. During outages,
keep fail-closed behavior and restore the provider, never bypass the gate.

## Railway setup and outstanding verification

1. Approve provider/account/plan and any costs, and identify a dedicated sandbox.
2. Review the implemented native-fetch TLS executor, its abort behavior and the
   runtime wiring. Do not set activation flags during sandbox testing.
3. Run real sandbox tests: simultaneous independent clients, exact allowance,
   TTL/window expiry, multi-key EVAL, errors, write/TTL permissions and recovery.
   Verify provider script semantics, consistency, eviction and command costs.
4. Verify the trusted gateway contract and direct-access prevention with spoofed
   headers. Configure private Railway variables manually only after approval.
5. Authorize runtime activation only after review/live verification. Check readiness
   and actual same-origin signup/login behavior in a controlled environment before
   a separately authorized deployment. No deployment is authorized by this phase.

Current tests use a serialized in-memory Redis simulation ONLY in tests. They
exercise multiple adapter instances/concurrent calls, budgets, TTL, identity
privacy, outages, cancellation, readiness and auth fail-closed behavior. They do
NOT execute Lua, connect to Redis or PostgreSQL, or prove real distributed
behavior. The numerical-answer migration remains untouched and unapplied.

## Phase 1E.2 live-test gate and current evidence

Local .env and process environment were inspected using presence-only diagnostics:
neither had the REST endpoint/token or dedicated test-target confirmation. No
live request was made, and the live test is skipped by default. Mock transport
coverage is not proof that Lua ran, Redis was healthy or live concurrency held.

Before requesting a live run, confirm the database in the Upstash console is
dedicated to testing, on the Free plan, contains no production data and cannot
incur paid usage. Configure credentials locally. Set AUTH_RATE_LIMIT_TEST_TARGET
to dedicated-upstash-free and AUTH_RATE_LIMIT_TEST_ENDPOINT_SHA256 to the SHA256
of the canonical REST origin (no trailing slash). The fingerprint binds the
operator-confirmed target to the actual URL; it does not discover the plan or
purpose automatically. Leave AUTH_RATE_LIMIT_ACTIVATED unset/false.

RUN_UPSTASH_LIVE_TESTS must explicitly be true to run the opt-in test. Supply
variables through the local process environment, or an ignored .env file using
Node's --env-file=.env. Never paste endpoint/token values into reports. Command:

node --env-file=.env node_modules/vitest/vitest.mjs run tests/auth/upstash-live.test.ts --no-cache --no-fsModuleCache --configLoader runner

The test makes at most 24 REST requests (with multiple Redis subcommands per
EVAL), creates a unique live_ namespace and synthetic HMAC identities, uses
10-second auth-key TTLs and a five-second probe TTL, and inspects ONLY exact
captured keys. No scan, wildcard cleanup or deletion is used. It checks allowance,
denial/retry seconds, independent budgets, eight live concurrent consumes across
two adapter instances (exactly three permits), identity isolation, TTL/expiry,
real probe and invalid-token rejection/recovery. It never calls auth routes or
PostgreSQL. Network failures, timeout, malformed responses and API 429 headers
are covered separately with mocks; no real outage injection is attempted.

Railway documents X-Real-IP, but the inspected public spec does not establish the
full reserved-header overwrite and direct-access-prevention contract required
here. No Railway ingress test or configuration change occurred. A verified
gateway must still strip and replace x-toprank-client-ip and block bypasses;
do not reinterpret arbitrary forwarding headers as trusted client identity.
Reference: https://docs.railway.com/networking/public-networking/specs-and-limits

## 2026-10-22 account lifecycle continuation

Presence-only recheck of local .env and process environment found no dedicated
Upstash REST credentials, test target or target fingerprint. No live call made.
Railway trusted-ingress behavior remains unresolved; no attestation activated.
Policy, guardian-verification, recovery-delivery and privacy-processing approvals
remain absent/disabled locally. Production signup/login remain fail-closed.

Parent accounts now require their own current adult policy receipt. Guardian
withdrawal invalidates dependent access; student withdrawal invalidates existing
public links and optional sharing. Recovery supports active students and parents,
not public staff recovery. Policies remain drafts with the supplied entity name
TOP RANK AI PRIVATE LIMITED. The private case queue is not automatic erasure.
See ACCOUNTS_CONSENT_PRIVACY_COMPLETION.md for commands, evidence and remaining gates.

## 2026-11-08 SIA signup and PIN workflow

New public flow: /signup dialogs -> /api/auth/pin actions requestSignup/verify/signup.
Mobile/PIN login uses action login; forgot PIN uses requestReset/verify/reset.
The old /api/auth/signup password-registration API is retired (410 after existing
origin/validation/limiter gates); it cannot bypass OTP. Existing password accounts
and staff keep /api/auth/login and their recovery; PIN accounts are excluded there.

AUTH_PIN_ENABLED=false and AUTH_PIN_EMAIL_VERIFIED=false remain default examples.
The dedicated server-only AUTH_PIN_HMAC_KEY must be independently generated.
Resend credentials/sender/domain delivery and existing distributed limiter/ingress
requirements must be verified before approval. Merely setting flags is not evidence.
No live email or authentication was activated. The SIA UI does not call a live model.
See SIA_SIGNUP_PIN.md for expiry, quota, lockout, migration and compatibility details.
