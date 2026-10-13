# TopRank AI: Phase 1 launch scope and foundation

2026-10-13 refresh: LAUNCH_PROGRAMME_PHASE1_REFRESH.md maps the subsequent Phases
2-9 code and current readiness. The original inventory/gaps below are the historical
2026-10-10 foundation snapshot, retained as evidence rather than current completeness
claims. Scope remains JEE Main/NEET UG, all ages with required consent, India/UAE,
free invited pilot. Dedicated database foundation remains blocked; production
authentication/payments were not activated. Public Phase 12 launch is not approved.

## Approved product decisions

Recorded from the user's explicit decisions on 2026-10-10:

- Exams: JEE Main and NEET UG.
- Audience: students of all ages. No blanket adults-only rule or arbitrary age exclusion.
- Offer: free invited pilot; payments and production authentication stay disabled.
- Named markets: India and UAE. "Middle East" is a growth intention, not a list of approved jurisdictions.
- Promise: useful daily preparation progress, not merely access to videos.
- Eight service verticals remain the product architecture. SIA connects them;
  commerce, operations and integrations are cross-cutting capabilities.

These are scope decisions, not production approval. The invite mechanism and
country/consent enforcement are not implemented by this foundation increment.
Do not describe current public signup as invite-only or legally verified.
Free pilot access must not depend on a payment provider or card collection.

## Existing functionality and acceptance checklist

"Existing" means repository code, not live PostgreSQL or browser verification.
The source inventory and MASTER_BUILD_STATUS.md support this map.

| Vertical | Existing evidence | Launch acceptance and gaps |
| --- | --- | --- |
| Exam discovery and goals | src/server/student/service.ts; student exam and onboarding APIs | Both selected exams have reviewed metadata, clear pilot coverage and saved goals; no fabricated official notices; onboarding resumes and confirms consistently |
| Study command centre | src/server/journey/planner.ts and service.ts; missions/study-session APIs | Goals produce achievable content-linked tasks; completion, skipping, rescheduling, conflicts and interrupted sessions persist correctly; weekly milestones remain a gap |
| Learning and concept mastery | src/server/content/service.ts; full exam/subject/chapter/lesson APIs | Every promised unit is published and navigable; resources work and are appropriately licensed; saved progress survives reconnect; authoring/import UI remains incomplete |
| Practice, mocks and revision | src/server/question, practice and mock; TIMED_MOCK_EXAMS.md | Reviewed questions, protected answers, correct scoring, idempotent attempts, autosave/deadline/resume and revision handoff; real constraints and concurrent finalization must pass |
| Competitions and recognition | src/server/competition; challenge/admin APIs | Ranks and badges derive from verified scores, ties/corrections are defined, duplicate awards are prevented, aliases/sharing respect consent; cash/prize fulfilment is not a pilot dependency |
| Guidance and support | src/server/help; src/server/sia | Support request/response ownership is enforced; SIA recommends available actions without invented progress; live AI, mentor booking and counselling are not launch claims |
| Digital student profile | student progress/profile APIs; observed mock/activity records | Separate effort, completion and performance; correct student isolation; history reflects real events; readiness predictions and certificates are not claimed |
| Parent and institution partnership | src/server/portal; PORTALS_CONSENT_TENANTS.md | Launch-required guardian consent works in signup/onboarding, verification and withdrawal; no intrusive dashboard controls; existing sharing consent is not automatically registration/legal consent; full institutional sales workflows can follow |

Cross-cutting acceptance: student-only signup, account recovery, invite control,
sessions, error recovery, mobile/accessibility acceptance, data deletion,
administrative publication, monitoring, backups/restore and support ownership.
Account recovery and versioned legal acceptance need explicit implementation
review in Phase 2. A visible checkbox alone is insufficient.

## Content gate (proposed measurable minimum; owner approval pending)

For EACH selected exam:

- Publish an exact syllabus/subject/chapter coverage manifest, reviewed against
  the applicable exam-year official source. Do not imply complete syllabus
  coverage when only selected pilot chapters are available.
- Cover 100% of the chapters advertised for the pilot with reviewed learning
  material, at least one usable lesson/resource, and at least 20 reviewed
  practice questions per chapter spanning relevant difficulty levels.
- Provide at least two distinct complete mock forms matching the advertised
  exam format; any shortened diagnostic is clearly labelled, not a full mock.
- Every published question has reviewed scoring rules, the protected answer,
  an explanation, subject/chapter mapping and resource/provenance rights.
- Every generated mission and revision action points to available content.
- Use named editorial and academic reviewers; verify corrections propagate
  without rewriting immutable historical attempts.

These quantities are planning proposals, not user-approved content inventory
or statistically validated sufficiency. No database was queried to count content.
Actual exam-year patterns, coverage, editorial owners and delivery dates remain
to be approved. Do not bulk-publish or fabricate content to satisfy a quota.

## All-ages privacy and consent work required before launch

Design registration for all ages with minimal age/jurisdiction determination
and no blanket age rejection. Public non-personal exploration can remain
available; account data processing must follow the applicable lawful workflow.
Do not substitute a restrictive parent dashboard for legal consent.

Phase 2 must implement actual server-enforced workflows, not policy-only text:

1. Clear Terms and Privacy notices with versioned, explicit acceptance; separate
   optional marketing/sharing permissions from required service terms.
2. Jurisdiction-aware guardian authorization where required, proportionate
   verification, pending/verified/withdrawn states and audited consent evidence.
3. Server-side gating of processing requiring that consent, minimal data before
   verification, appropriate retention/deletion and re-consent on material changes.
4. Easy withdrawal, next-request enforcement and defined consequences for existing
   sessions, learning data, public sharing and future package purchases.
5. No unnecessary collection of identity documents, sensitive identifiers,
   profiling, targeted advertising or external AI transfer of children's data.
6. Legally reviewed parent authority, student rights, grievance handling,
   international transfers, hosting and provider agreements for the actual markets.

India: official DPDP rules have phased commencement; legal review must determine
the provisions effective at the actual launch date and applicable exemptions.
Do not assume an educational-product exemption or blanket parental-consent waiver.
[MeitY rules](https://www.meity.gov.in/documents/act-and-policies/digital-personal-dataprotection-rules-2025gDOxUjMtQWa?pageTitle=Digital-Personal-Data-ProtectionRules-2025),
[MeitY 2025-26 annual report](https://www.meity.gov.in/static/uploads/2026/04/46face7d48c8f6a97030f713ad5fdab4.pdf).

UAE: the official government child digital-safety guidance identifies safeguards
for under-13 personal data, including guardian consent and withdrawal. Counsel
must confirm applicable classification, statutory requirements, and whether
federal or free-zone regimes apply to the actual operating entity.
[UAE child digital safety](https://u.ae/en/information-and-services/social-affairs/children/Childrens-digital-safety),
[UAE data protection](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws.).

This is an engineering requirements register, not legal advice or compliance
certification. Other Middle Eastern countries require a named country and review.
No age/jurisdiction policy or consent flow was silently activated in Phase 1.
No student group is permanently excluded; completing its legally required
workflow is a launch dependency, not a reason to process its data unlawfully.

## Environment separation

| Environment | Selection | Boundary |
| --- | --- | --- |
| Development | existing .env / prisma7.config.ts | Ordinary URL remains unidentified and untouched; no current DB connection authorized |
| PostgreSQL verification | ignored .env.verification.local ONLY | New guarded preflight rejects fallback, inherited overrides and unknown target; independent fresh local cluster |
| Staging | approved private service variables | Independently owned DB, no production data/secrets, separate activation/hosting approval |
| Production | separately approved service secrets | Never a test target; deployment and auth/payment activation remain out of scope |

Templates are in config/environments/*.env.example. They contain placeholders,
are intentionally unusable unchanged, and do not provision environments.
Never copy staging/production credentials into local tests. Actual credential
files stay ignored and locally access-controlled. Production auth gates and the
null commerce provider were not changed. Do not set flags to bypass readiness.

## Guarded PostgreSQL foundation

The user explicitly approved portable PostgreSQL 17 acquisition, a fresh
LocalAppData/TopRankVerify/pg17-<GUID> cluster, loopback port 15432, identity
inspection and conditional test-only owner/database creation. Approval excludes
existing DBs, migrations, seeding, fixtures, missing-runtime installation and
production activation. See section 14 of CONTROLLED_VERIFICATION_REPORT.md for
the proposed setup sequence. No directory, secret or cluster was created yet.

Provisioning attempt: the official EDB page was accessible through web research,
but this machine's shell could not connect. The approved elevated retry failed
DNS resolution for www.enterprisedb.com. No ZIP was acquired/executed. STOP;
do not guess a package URL, use an untrusted mirror, or reuse an existing DB.
Resume when the machine can reach the official-linked publisher or the user
provides a locally acquired, provenance-verified approved binary ZIP.

New guard implementation: verification/postgres-target.ts and postgres-preflight.ts.
It selects only .env.verification.local, exact 32-hex GUID database/path,
127.0.0.1:15432, the toprank_test_owner role, verified PID/executable and
PostgreSQL 17. It rejects
ordinary/process URL fallback, PG defaults, extra URL options, unknown file
keys, production mode and provider/activation settings. No connection occurs
without --connect plus TOPRANK_TEST_READ_APPROVED=true. On Windows, local process,
version-file and loopback listener identity must match BEFORE connecting.

The approved test owner should be NOSUPERUSER/NOCREATEDB/NOCREATEROLE. The future
setup must explicitly authorize GRANT pg_read_all_settings TO toprank_test_owner
on this fresh instance so read-only inspection can check data_directory; absent
that permission the preflight refuses safely. This additional grant is proposed,
not executed and not assumed covered by earlier approval.

The preflight uses bounded connection/query timeouts and READ ONLY transactions;
checks server/database/user/owner/data-directory/version and empty non-system
schemas/objects; exposes only generic failures, never secret transport details.
It closes the connection after success or failure. Config markers alone are not
proof of disposability; fresh creation history and explicit approval remain required.

Safe offline command (no connection):

```powershell
node node_modules/tsx/dist/cli.mjs postgres-preflight.ts
```

ONLY after the fresh target identity, local secrets, inspection permission and
read approval are established:

```powershell
node node_modules/tsx/dist/cli.mjs postgres-preflight.ts --connect
node node_modules/vitest/vitest.mjs run --config vitest.postgres.config.ts --configLoader runner --no-cache --no-fsModuleCache
```

The separate Vitest configuration runs only a READ-ONLY empty-target identity
smoke test. The normal suite skips it. It is not migration replay or critical-flow
integration testing. No app DATABASE_URL is rebound, and no application client is
imported by it. Default migration scripts still select the ordinary URL: do not
run them. A guarded write launcher, populated-schema checks and app-fixture
harness require a subsequent reviewed increment and target-specific approval.

## Phase 1 exit checklist

- [x] Exam, audience and free-pilot decisions recorded.
- [x] Eight verticals mapped to code and acceptance requirements.
- [x] Proposed content gate and legal prerequisites documented.
- [x] Dedicated environment templates and fail-closed read-only configuration built.
- [ ] Content coverage quantities/owners and exam-year syllabus scope approved.
- [ ] PostgreSQL package acquired and fresh target created/positively verified.
- [ ] Additional read-settings permission approved, then live preflight passed.
- [ ] Phase 1 checklist accepted by product owner.

Phase 1 is PARTIALLY COMPLETE, with safe repository foundation available but no
live database infrastructure established. Phase 2 and production activation
have not started. Verification results and final Git inventory are appended to
CONTROLLED_VERIFICATION_REPORT.md after checks finish.
