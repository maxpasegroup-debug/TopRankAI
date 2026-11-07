# Environment boundaries

| Purpose | Configuration | Permitted target/use |
| --- | --- | --- |
| Development | development.env.example -> approved local application environment | Separately identified development DB; ordinary .env is NOT disposable evidence |
| Verification | verification.env.example -> ignored .env.verification.local | Fresh local PostgreSQL 17, exact GUID/database/PID/path, 127.0.0.1:15432 only |
| Staging | staging.env.example -> private hosting environment variables | Separate approved project/environment, DB, secrets and origin; no production data |
| Production | production.env.example -> production hosting variables after approval | Separate approved DB/runtime/migration credentials and canonical HTTPS origin |

Templates are not provisioned infrastructure. TOPRANK_ENVIRONMENT labels intent;
it is not an access-control mechanism. Staging uses NODE_ENV=production because
Next.js does not define a separate staging NODE_ENV. Do not invent NODE_ENV=staging
or assume Next.js will automatically load a file named .env.staging.local.

Next.js loads root .env files by its documented precedence. Do not co-locate staging
and production secret files in an ordinary developer checkout or copy their DSNs
into .env. Supply each hosting environment's variables separately, with a distinct
database identity and secret set. Do not expose secrets through NEXT_PUBLIC_*.
Keep production authentication, guardian approval and recovery activation disabled
until separately verified and approved. Payment and knowledge factories remain off.

Verification is deliberately NOT a normal Next.js app launch. The runner reads ONLY
.env.verification.local with node:util parseEnv and rejects ambient DATABASE_URL,
PG*, alternate test settings, production mode and provider activation/credentials.
It never imports dotenv/config, the normal Prisma config, db:seed or app server.
The child Prisma process receives an allowlisted OS environment and its sole
DATABASE_URL from the verified dedicated target, via verification/prisma.config.ts.
Do not export a DSN in your terminal to get around guard failures.

Local bootstrap writes its random test password only to ignored dedicated config
and scopes the fresh LocalAppData directory to the current Windows account. The
disposable owner has no superuser/createdb/createrole privileges; pg_read_all_settings
is granted solely to inspect identity in this new cluster. This is NOT an application
or production privilege recommendation. The bootstrap admin password is not retained.

Before staging/production exists, an authorized operator must verify control-plane
access, distinct database identities, least privilege, origins, backups and recovery.
No template, local test or CI result proves those remote boundaries are established.
