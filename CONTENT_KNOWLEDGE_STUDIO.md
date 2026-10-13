# Content & Knowledge Studio

Implementation increment: 2026-10-10. NOT launch or content-library approval.

## Internal Implementation Plan

Reuse Exam, Subject, Chapter, Lesson, Question, AuditEvent and their services.
Extend /admin/content; do not duplicate the learning or scoring engine.
Add immutable syllabus versions mapped to canonical subjects/chapters, source and
licence verification, bounded import previews and disabled SIA ingestion jobs.
Keep reviewed/published authoring immutable until staged revision support exists.
Use serializable mutations, strict input validation and platform-admin access.
Leave all migrations unapplied. Verify with mocked tests and offline build tools.

## Evidence

## 1. Completed Features

- Eight named workspaces at /admin/content, connected to existing operations.
- Canonical exam/subject/chapter/lesson/resource authoring and editorial review
  retained; no duplicate catalogue, learning, user, question or audit engine.
- Immutable SyllabusVersion records reference canonical exams and subject/chapter
  IDs, with administrator-supplied topics/objectives, source URL, evidence,
  effective date, label and published-version succession.
- Server-owned syllabus transitions: DRAFT -> PENDING_REVIEW -> APPROVED ->
  PUBLISHED -> RETIRED. Pending review can request changes. Decisions are audited;
  authors cannot approve or request changes on their own versions.
- Source/rights holder/origin/licence/attribution/permission-evidence records.
  Original, licensed, public-reference and AI-assisted origins remain distinct.
  Independent source verification is bound to the current content fingerprint.
  Edits clear verification and SIA inclusion and invalidate existing jobs.
- Future publication of EXAM, SUBJECT, EXAM_SUBJECT, CHAPTER, LESSON and RESOURCE
  now requires both current independent editorial review and independently
  verified source/licence metadata. Publishing does not refresh SIA.
- Reviewed or currently published canonical content cannot be overwritten by the
  authoring endpoint. Create a separate draft instead. This is a safety boundary,
  not a completed staged-revision/swap workflow.
- Bounded question directory with search, type/difficulty/language/status/review
  and missing-explanation indicators; its query excludes keys, options/correctness,
  numerical answers and solution references.
- JSON dry-run previews: per-row validation, batch duplicate detection, typed
  backward parent references and fingerprint-bound explicit confirmation.
  Execution remains one serializable, atomic create-only draft transaction.
  Completed batches add an audit event identifying created records.
- Minimal bounded content activity history: actor, date, action, entity and ID.
- SIA inclusion/exclusion, eligibility reasons and durable unique refresh requests.
  Eligible sources must be published, independently reviewed/licence-verified
  lessons with current fingerprints and available parents.

## 2. Partial or Disabled Functionality

This is a coherent first increment, NOT completion of the entire master prompt.

- Question Bank is read-only here. Create-question action is explicitly disabled.
  Canonical scoring/import validation and existing mock/practice flows are reused,
  not replaced. Question authoring, independent review assignment, protected
  revisions, duplicate similarity and blueprint-association editors remain pending.
- Syllabus creation uses a validated JSON outline, not a visual hierarchical editor.
  Correct a changes-requested version by creating a new uniquely labelled draft.
  In-place version editing/reordering and completeness-by-topic remain pending.
  Published syllabus labels are governance records, NOT official certification.
- Syllabus versions are not yet pinned to student goals, progress or attempts;
  no existing goal reference is migrated or changed.
- Lesson publication still uses existing canonical records. Staged revisions,
  full immutable lesson-history snapshots, preview, prerequisites, author metadata,
  language/difficulty/duration controls and practice associations remain pending.
  Existing mock snapshots and practice-result snapshots were left intact.
- CSV import, field mapping, question/syllabus imports, persistent import-job row
  results and full import history/retry UI are pending. No CSV parser was installed.
  File upload/storage is not implemented; existing safe external resources remain.
- Draft lesson workflow retains existing draft/review/publish actions. Assignment,
  pending-review/change-request states and comment timelines for lessons are pending.
- Only existing PLATFORM_ADMIN authorization is granted. No delegated content
  manager/subject author/reviewer/publisher permissions were invented or enabled.
- Knowledge provider and ingestion worker are absent. Requests remain BLOCKED;
  failed/stale requests can return to BLOCKED without claiming indexing. There is
  no vector search, generated AI answer, successful indexing or retrieval update.
  Syllabus/question-explanation ingestion is not enabled.
- Studio overview limits exams to 100 and each other list to 50 (question list
  100); truncation is explicit. Complete pagination/filtering remains pending.

## 3. Routes and Student Connections

- /admin/content: server-authenticated PLATFORM_ADMIN Studio.
- /api/admin/content/studio: private overview and strict governance mutations.
- /api/admin/content/questions: private answer-free bounded directory.
- /api/admin/content/import/preview: POST, strict bounded reader, no DB reads/writes.
- /api/admin/content/import: POST, confirmed pack envelope; previous direct-pack
  API calls now receive validation errors and must be updated.
- Existing /api/admin/content, /review, /coverage and /api/admin/publication remain.
- Existing /learn/catalogue, scoped lesson navigation, /learn/saved, progress,
  practice, timed mocks, revision, missions and digital profile services retained.
  Their canonical IDs are not replaced. Lesson completion is not labelled mastery.
- Existing deterministic SIA remains unchanged. The Studio does NOT supply new
  knowledge to it or claim that a refresh has completed.

## 4. Important Files

- prisma/schema.prisma and new migration .008: three governance models.
- src/server/content/studio-validation.ts and studio.ts: strict server actions,
  transitions, relationships, licence eligibility, transactions and audit.
- src/server/content/import-preview.ts: bounded preview and same-batch confirmation.
- src/server/content/editorial.ts: current verified source/licence publication gate.
- src/server/content/authoring.ts: immutable reviewed/published edits and batch audit.
- src/server/sia/knowledge-adapter.ts: provider-neutral contract; factory returns null.
- src/components/learning/StudioWorkspace.tsx: connected eight-workspace shell.
- ContentWorkspace.tsx/.module.css: embedded editor, dry-run/confirmation, tabs.
- Admin content page and Studio/question/import/preview API routes.
- OperationsWorkspace.tsx: renamed Studio entry.
- next.config.ts/tsconfig.json: isolated verification output, preserving earlier
  Phase 2/3 paths. Next-generated next-env.d.ts default imports restored.
- New studio tests; prior editorial/operations tests adjusted for stricter gates.
- MASTER_BUILD_STATUS.md and CONTROLLED_VERIFICATION_REPORT.md: append-only evidence.

## 5. Schema and Unapplied Migration

New: 20261010000800_content_knowledge_studio/migration.sql.

SyllabusVersion: canonical exam FK, immutable outline, unique exam/label, review
state and author/reviewer FKs, restrictive succession FK.
ContentSource: one metadata record per canonical entity/ID, independent review,
content fingerprint, SIA inclusion, restrictive author/reviewer FKs.
ContentKnowledgeJob: unique source/fingerprint, state/reason/completion evidence,
restrictive source/requester FKs. Indexed state/creation time.
SQL CHECKs constrain states, origins, fingerprints and independent reviews.

Historical migrations were NOT edited. Existing .006 and .007 and new .008 are
unapplied. No migration status, diff requiring a DB/shadow DB, migrate, seed,
introspection, import or database connection was executed.
SQL contract tests inspect files only; they do not establish PostgreSQL behavior.

## 6. Actual Verification

All persistence tests are mocked; the two gated live tests remain skipped.

~~~powershell
npx.cmd vitest run tests/content tests/student/operations.test.ts tests/question tests/mock tests/student/sia.test.ts
# PASS: 353 tests across 22 files.
npm.cmd test
# PASS: 1,173 passed, 2 skipped; 54 passed files, 2 skipped files.
npm.cmd run typecheck
# PASS.
npm.cmd run prisma:generate
# PASS: Prisma 7.10.0 client generated locally; no database access.
npx.cmd prisma validate --config prisma7.config.ts
# PASS.
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'studio'}});process.exit(r.status??1)"
# PASS: isolated optimized Next.js 16.3.5 build.
git -c core.safecrlf=false diff --check
# PASS.
~~~

Initial focused run failed two parent-validation fixture assertions because the
new immutable guard ran first. Parent validation now precedes that guard, still
before any writes. Final focused and full runs pass. An initial npm invocation
without .cmd was blocked by PowerShell execution policy; no policy was changed.

Anonymous built preview at http://127.0.0.1:3008:
/admin/content 307; Studio and question GET APIs 401; import-preview POST 401.
GET import-preview 405 (POST-only). No credentials, authenticated admin actions
or import were submitted. These are HTTP boundary checks, NOT browser acceptance.
No desktop/mobile screenshots or authenticated browser/persistence verification.

## 7. Import Format and Recovery

JSON only; 512 KiB total envelope, 1-60 keyed records, version 1.
The preview checks shape, per-row fields, keys/identity duplicates within the batch
and earlier correctly typed @parent references. It DOES NOT check database duplicates.
Uniqueness and canonical parent checks execute atomically during actual import.
No import was executed in this increment.

~~~json
{
  "version": 1,
  "records": [
    {
      "key": "subject-key",
      "draft": {
        "entity": "SUBJECT",
        "code": "SUBJECT_CODE",
        "name": "Subject name",
        "slug": "subject-name"
      }
    }
  ]
}
~~~

Supported draft columns:
EXAM code/name/category/description/officialUrl;
SUBJECT code/name/slug;
EXAM_SUBJECT examId/subjectId/order;
CHAPTER subjectId/title/slug/summary/order;
LESSON chapterId/title/slug/summary/order/body;
RESOURCE lessonId/title/slug/type/url/reference/order.
Lesson body: version 1, sourceNote and sections with kind/title/text. Review requires
OBJECTIVE, CONCEPT, EXAMPLE, CHECK and SUMMARY. There are no HTML uploads.
No ownership, status, reviewer claims or overwrite IDs are accepted by imports.
Parent IDs may be canonical IDs or earlier @key references of the appropriate type.

Execution envelope: pack, previewFingerprint and confirmed: true. The server
revalidates and recomputes the digest; changing the pack invalidates confirmation.
The digest binds content; it is not a signed approval or authorization credential.
Authentication, administrator role and origin checks are separate server gates.

Execution is all-or-nothing, not a partial import. On failure, rollback should
leave no imported drafts (mocked transaction evidence only, real DB not verified).
Do not automatically retry an uncertain network outcome: inspect batch audit and
canonical keys first. Repeated keys conflict instead of silently overwriting.
Persistent import idempotency receipts and row-level recovery UI remain pending.

## 8. Approval and Publishing

Editorial review records session-derived independent reviewer, time, evidence,
revision and content fingerprint. Source/licence verification is a separate action
with its own independent reviewer and audit evidence. Both are required for future
publication of the six supported editorial types. The published parent hierarchy
must also be available. Client-supplied approvals are rejected.
Source metadata alone is neither a licence grant nor proof of educator competence.
Operators must supply real rights evidence and competent educator review.

Legacy published content is not automatically quarantined or retroactively certified.
Legacy question publication retains its prior controls and is NOT covered by the
new independent source/licence gate. This remains a release prerequisite.

## 9. SIA Knowledge Tracking

Include only eligible reviewed lessons. Requests freeze a fingerprint combining
current content and verified source/licence metadata. Unique source/fingerprint
prevents duplicate records, including through the database constraint.
Excluded/changed sources invalidate jobs. Overview calculates stale state for
currently checked sources; jobs outside its bounded source window explicitly show
that current eligibility was not checked.
Retry FAILED/STALE requests safely returns BLOCKED; it does not call a provider.
No worker, indexing acknowledgement, provider reference or successful update exists.
Last successful update remains null. Future worker implementation must re-check
eligibility immediately before ingestion, implement deletion/invalidation, record
actual acknowledgements, and enforce exam/access/privacy scope during retrieval.

## 10. External Prerequisites

Approved disposable PostgreSQL and complete forward migration verification;
authenticated desktop/mobile acceptance; educator-supplied reviewed licensed corpus
and approved launch coverage; documented rights/attribution policy and qualified
reviewers; production legal/guardian/session/recovery/ingress gates; separately
approved knowledge provider/worker/privacy/cost limits. Nothing is activated here.

## 11. Security Limitations

No live PostgreSQL integrity, serializable races or rollback were verified.
Canonical content references in ContentSource are polymorphic and validated by
the server, not FK-bound to six separate content tables. Syllabus JSON parent IDs
are validated on creation but have no per-node database FKs.
Reviewed/currently published edits are blocked, not fully versioned. Legacy rows
with no editorial history require review before any retire/edit migration.
Existing question publication needs independent-review/licence hardening before
the full Question Bank manager can ship. Delegated permissions and full audit/
review timelines remain pending. No student key exposure was introduced; protected
answer and mock/practice tests pass, but this is not an external security audit.

## 12. Git and Execution Boundaries

Branch main. Working tree remains dirty; existing work was preserved.
126 status entries at final inventory, including 15 pre-existing staged paths.
No index commands were executed; those staged paths were not replaced or unstaged.
No commit, push, deployment, database connection, migration, seed, import execution
or dependency installation occurred. No production activation or provider call.
Safe flag inspection printed only enabled=false for authentication activation/live
verification/proxy, policy/guardian approval and recovery delivery. Commerce and
knowledge adapter factories remain null. No environment secrets were printed.
Git warns that the global ignore file is unreadable; it was not modified.

Studio-only scope for review (shared files contain earlier uncommitted work):

~~~powershell
$studioFiles = @(
  'CONTENT_KNOWLEDGE_STUDIO.md',
  'MASTER_BUILD_STATUS.md', 'CONTROLLED_VERIFICATION_REPORT.md',
  'next.config.ts', 'tsconfig.json', 'prisma/schema.prisma',
  'prisma/migrations/20261010000800_content_knowledge_studio/migration.sql',
  'src/app/admin/content/page.tsx',
  'src/app/api/admin/content/import/route.ts',
  'src/app/api/admin/content/import/preview/route.ts',
  'src/app/api/admin/content/questions/route.ts',
  'src/app/api/admin/content/studio/route.ts',
  'src/components/journey/OperationsWorkspace.tsx',
  'src/components/learning/ContentWorkspace.tsx',
  'src/components/learning/ContentWorkspace.module.css',
  'src/components/learning/StudioWorkspace.tsx',
  'src/server/content/authoring.ts', 'src/server/content/editorial.ts',
  'src/server/content/import-preview.ts', 'src/server/content/studio-validation.ts',
  'src/server/content/studio.ts', 'src/server/sia/knowledge-adapter.ts',
  'tests/content/editorial.test.ts', 'tests/student/operations.test.ts',
  'tests/content/studio.test.ts', 'tests/content/studio-routes.test.ts',
  'tests/content/studio-ui.test.tsx', 'tests/content/studio-migration.test.ts'
)
git status --short
git diff -- $studioFiles
# Review and include prerequisite Phase 2/3 changes using their existing reports.
# Do not commit this scope alone if those prerequisites are not yet committed.
# Review the existing index as well: it already contains 15 unrelated/prior entries.
git add -- $studioFiles
git diff --cached
git commit -m "Add first Content and Knowledge Studio increment"
git push origin main
~~~

These are commands for operator review only; NONE were executed.

## 13. Single Next Build Task

Implement the staged immutable lesson/question revision and independent review
workflow, preserving canonical IDs and historical attempts, before enabling full
Question Bank authoring or published lesson replacement. Keep database writes,
production activation and live ingestion disabled until separately authorized.

## Appendix: Final Git Status

Exact expanded porcelain inventory (including prior work; not a staging list):

~~~text
 M .gitignore
AM CONTROLLED_VERIFICATION_REPORT.md
MM MASTER_BUILD_STATUS.md
M  PORTALS_CONSENT_TENANTS.md
 M next.config.ts
A  prisma/migrations/20261010000500_portal_scope_integrity/migration.sql
A  prisma/migrations/migration_lock.toml
 M prisma/schema.prisma
M  src/app/[[...path]]/page.tsx
 M src/app/api/auth/signup/route.ts
 M src/app/api/student/content/chapters/[chapterSlug]/lessons/route.ts
 M src/app/api/student/content/lessons/[lessonSlug]/route.ts
A  src/app/workspace/page.tsx
 M src/components/journey/JourneyWizard.tsx
 M src/components/journey/OperationsWorkspace.tsx
MM src/components/portal/PortalWorkspace.tsx
MM src/screens/AuthPages.tsx
 M src/screens/Learn.tsx
 M src/screens/Settings.tsx
 M src/screens/learning/LessonExperience.tsx
 M src/screens/learning/SubjectWorkspace.tsx
 M src/server/api/admin-handler.ts
 M src/server/auth/request-security.ts
 M src/server/auth/session.ts
 M src/server/auth/validation.ts
 M src/server/content/service.ts
 M src/server/journey/service.ts
 M src/server/operations/service.ts
M  src/server/portal/authorization.ts
M  src/server/portal/service.ts
 M src/server/student/service.ts
 M src/server/student/validation.ts
 M tests/auth/hardening-routes.test.ts
 M tests/auth/signup-route.test.ts
 M tests/auth/signup-ui.test.ts
 M tests/auth/validation.test.ts
 M tests/content/service.test.ts
M  tests/portal/authorization.test.ts
M  tests/portal/lifecycle.test.ts
A  tests/portal/migration-contract.test.ts
A  tests/portal/workspace.test.ts
 M tests/student/journey.test.ts
 M tests/student/operations.test.ts
 M tests/student/service.test.ts
 M tsconfig.json
 M vitest.config.ts
?? AGENTS.md
?? CLAUDE.md
?? CONTENT_KNOWLEDGE_STUDIO.md
?? EXAM_CATALOGUE_LEARNING.md
?? LAUNCH_FOUNDATION.md
?? STUDENT_ACCOUNTS_ONBOARDING.md
?? config/environments/development.env.example
?? config/environments/production.env.example
?? config/environments/staging.env.example
?? config/environments/verification.env.example
?? content/launch/jee-neet-foundation-drafts.json
?? postgres-preflight.ts
?? prisma/migrations/20261010000600_accounts_consent_recovery/migration.sql
?? prisma/migrations/20261010000700_learning_editorial/migration.sql
?? prisma/migrations/20261010000800_content_knowledge_studio/migration.sql
?? src/app/account/consent/page.tsx
?? src/app/account/guardian-consent/page.tsx
?? src/app/admin/accounts/page.tsx
?? src/app/admin/content/page.tsx
?? src/app/api/account/consent/route.ts
?? src/app/api/account/guardian-consent/route.ts
?? src/app/api/admin/accounts/route.ts
?? src/app/api/admin/content/coverage/route.ts
?? src/app/api/admin/content/import/preview/route.ts
?? src/app/api/admin/content/import/route.ts
?? src/app/api/admin/content/questions/route.ts
?? src/app/api/admin/content/review/route.ts
?? src/app/api/admin/content/route.ts
?? src/app/api/admin/content/studio/route.ts
?? src/app/api/auth/guardian-consent/check/route.ts
?? src/app/api/auth/recovery/route.ts
?? src/app/api/auth/reset-password/route.ts
?? src/app/api/student/saved-resources/route.ts
?? src/app/guardian-registration/page.tsx
?? src/app/learn/catalogue/[examCode]/page.tsx
?? src/app/learn/catalogue/page.tsx
?? src/app/learn/saved/page.tsx
?? src/app/privacy/page.tsx
?? src/app/recover-account/page.tsx
?? src/app/reset-password/page.tsx
?? src/app/terms/page.tsx
?? src/components/account/AccountConsent.tsx
?? src/components/account/AdminAccounts.tsx
?? src/components/account/GuardianConsent.tsx
?? src/components/account/RecoveryForm.tsx
?? src/components/learning/ContentWorkspace.module.css
?? src/components/learning/ContentWorkspace.tsx
?? src/components/learning/SavedResources.tsx
?? src/components/learning/StudioWorkspace.tsx
?? src/server/api/json-body.ts
?? src/server/auth/account-consent.ts
?? src/server/auth/recovery.ts
?? src/server/content/authoring-validation.ts
?? src/server/content/authoring.ts
?? src/server/content/coverage.ts
?? src/server/content/editorial.ts
?? src/server/content/import-preview.ts
?? src/server/content/saved-resources.ts
?? src/server/content/studio-validation.ts
?? src/server/content/studio.ts
?? src/server/sia/knowledge-adapter.ts
?? src/shared/account-policy.ts
?? src/shared/lesson-content.ts
?? tests/auth/account-consent.test.ts
?? tests/auth/account-sessions.test.ts
?? tests/auth/recovery.test.ts
?? tests/content/authoring-routes.test.ts
?? tests/content/editorial.test.ts
?? tests/content/json-body.test.ts
?? tests/content/learning-ui.test.tsx
?? tests/content/saved-resources.test.ts
?? tests/content/studio-migration.test.ts
?? tests/content/studio-routes.test.ts
?? tests/content/studio-ui.test.tsx
?? tests/content/studio.test.ts
?? tests/foundation/postgres-target.test.ts
?? tests/postgres-live/identity.pg.test.ts
?? tests/postgres-live/read-only.setup.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
~~~
