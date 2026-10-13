# Phase 3 Exam Catalogue and Learning

Date: 2026-10-10. The implementation passes local checks, but the Phase 3 release
exit is NOT VERIFIED: no educator-approved launch corpus or approved PostgreSQL
target was supplied. Existing account, portal and foundation work is preserved.
No database was connected, populated or migrated. Production authentication,
policy/guardian approval, recovery delivery and payments remain disabled.

## Learning workflows

- Added exam catalogue, per-exam subjects and saved-resource navigation. Existing
  selected-exam learning home and subject/chapter/lesson routes are reused.
- Published/active ancestor filters remain. Ambiguous unscoped chapter or lesson
  slugs are rejected. Chapter APIs accept subjectSlug; lesson APIs require both
  subjectSlug and chapterSlug when context is supplied. Unique legacy slugs still
  work. Protected chapter/lesson responses are explicitly no-store.
- Structured lesson JSON contains source provenance and bounded objective,
  concept, worked-example, understanding-check and summary sections. Student
  output is escaped React text, never executable imported HTML.
- Database-backed subject views no longer show invented percentages, demo
  missions or demo activity. Unrelated demonstration screens are preserved.
- Existing lesson bookmark/completion persistence is reused. Progress mutations
  check current lesson entitlement before a write.
- Individual resource bookmarks are session-student-owned and idempotent.
  Paginated reads recheck published ancestry and entitlement before exposing
  links/reference content. Archived resource bookmarks can still be removed.

## Editorial operations

The PLATFORM_ADMIN-only /admin/content workspace supports draft creation/editing
for exams, subjects, exam-subject links, chapters, lessons and resources; bounded
listing/cursors; file/JSON import; independent review; publication/archive; and a
launch coverage table. Staff provisioning/roles are unchanged. Classroom teachers
are not granted global editorial privileges.

Draft writes/imports/reviews use serializable transactions and revision checks.
Author edits return content to DRAFT, increment the revision and clear approval.
Existing records cannot be reparented. Imports create drafts only, with a maximum
of 60 records/512 KiB; @key references must identify earlier parents of the correct
type. Duplicate keys, forward references and overwrite imports are rejected.
Uniqueness/serialization conflicts require a reload rather than an overwrite.

Review requires a different authenticated operator from the revision's author,
an evidence/rights reference and explicit accuracy/rights attestations. This
records a human review; it does not prove expertise or licensing from a checkbox.
Have a qualified educator perform the actual review. Current fingerprints include
teaching content, source/reference data, order and parent identifiers. The existing
publication API enforces the same gate, so the older UI cannot bypass it.
Review evidence/fingerprints remain in audit events; full historical body snapshots
and version rollback are not implemented.

Publish in this order: exam and subject, exam-subject link, chapter, lesson,
resource. Parent content must be active/published. Existing records without
editorial metadata must be saved as drafts and independently reviewed before
republishing. Legacy published records are not automatically quarantined or
certified: audit them before release. The old seed is not the reviewed publication
pipeline and was neither changed nor executed.

The shared streaming JSON reader has explicit editorial budgets of 160 KiB per
draft and 512 KiB per import. Authentication retains its original 4 KiB default
and 32 KiB maximum. Session-derived authority, origin checks, strict validation,
generic errors and no-store behavior are retained.

## Draft content and coverage

content/launch/jee-neet-foundation-drafts.json contains 32 original draft records:
2 exams, 4 subjects, 6 exam-subject links, 4 foundation chapters, 8 structured
lessons and 8 inline recap resources. Codes match the repository: JEE_MAIN and
NEET (displayed as NEET UG).

The AI-authored drafts cover motion measures, atomic/mole concepts, sets/
quadratics and cellular/enzyme fundamentals. Their provenance explicitly says
they are not independently educator-reviewed. This is a starter pack, not
sufficient full-syllabus preparation. None was imported, human-reviewed or
published during Phase 3.

The draft catalogue references the official
[JEE Main 2026 syllabus listing](https://jeemain.nta.nic.in/document/syllabus-2026/)
and [NEET UG 2026 syllabus listing](https://neet.nta.nic.in/document/syllabus-for-neet-ug-2026-examination/).
These links do not certify lesson alignment. Educators must map coverage against
the applicable examination year's syllabus before launch.

Coverage reporting distinguishes published lessons from current independently
reviewed structured lessons, flags truncation, and reports required subjects and
available chapters. Counts do not constitute full-syllabus sign-off. Parent
catalogue reviews, quality, rights and an approved unit-by-unit matrix are separate
release checks.

The create-only pack is suitable only for an approved empty/disposable target
after migrations. It refuses to overwrite existing codes/slugs. For a populated
catalogue, adopt existing records individually or prepare a reviewed subset using
known parent IDs. Do not seed or bypass review to make figures appear complete.

## Verification

Forward-only 20261010000700_learning_editorial adds nullable Lesson.body,
ContentEditorialRecord and StudentSavedResource, with owner/resource foreign keys,
unique keys and editorial review consistency checks. Migration NOT APPLIED.
Earlier pending migrations and schema changes are preserved.

Executed commands:

~~~powershell
node node_modules/prisma/build/index.js generate --config prisma7.config.ts
node node_modules/vitest/vitest.mjs run tests/content tests/student tests/auth tests/portal
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate --config prisma7.config.ts
node -e "const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,TOPRANK_VERIFY_BUILD:'phase3'}});process.exit(r.status??1)"
git diff --check
git status --short --untracked-files=all
~~~

Results: full suite 1,119 passed/2 gated tests skipped; focused suite 668 passed/
1 gated test skipped. TypeScript, Prisma generation/validation, isolated Next
production build and whitespace checks passed.

Initial checks caught and corrected a demo/production narrowing error, obsolete
publication fixtures, an editorial request budget exceeding the auth-only reader
cap, and a reader parameter type mismatch. Vitest now includes TSX with automatic
JSX transformation so rendering tests execute. A narrow ignore exception prevents
the coverage API from being hidden by the general coverage-output rule.

Regression tests cover role/origin/size/ownership boundaries, draft-only imports,
reference resolution, revision/fingerprint and independent review, parent
availability, entitlement loss, bookmark predicates, ambiguous slugs, byte budgets,
HTML escaping and no invented production progress.
Persistence/transaction tests use mocks. Real rollback, concurrent publication/
review and cross-session PostgreSQL persistence are NOT VERIFIED.

Anonymous HTTP checks on http://127.0.0.1:3007 returned 200 for signup, 307 to login
for catalogue/exam/saved/operator pages, and 401 for protected content/coverage/
saved-resource APIs. No forms were submitted. Browser inventory is empty;
authenticated desktop/mobile visual acceptance remains unverified.

The fixed phase3 build output is .next/phase3-verification. Earlier previews are
not stopped or cleared. Generated type include paths remain in tsconfig.json;
next-env.d.ts was restored to its original default imports.
No database connection, migration/seed, installation, credential/provider flow,
production activation, commit/push or deployment occurred. No secrets were printed.

## Release gates

1. Approved disposable PostgreSQL identity, pending migrations, real ownership/
   rollback/concurrency/progress tests and authenticated acceptance.
2. Licensed educator-reviewed material and an approved unit-by-unit JEE Main/
   NEET UG coverage matrix. Eight draft lessons do not meet this.
3. Qualified separate author/reviewer identities, source/rights evidence and
   legacy published-content adoption/review. Existing account/legal gates apply.
4. Desktop/mobile browser acceptance, accessibility and loading/error/empty-state
   usability. Static rendering does not replace these checks.
5. Content backup/versioning, external-resource availability and editorial
   operations. Truncated coverage cannot be treated as a complete audit.

## Commit and Push Commands

NOT EXECUTED. Review the prerequisite staged portal and unstaged Phase 1/2 work
first: shared paths contain their current edits too. Phase 3 is not standalone.
Commit dependencies coherently before these scoped commands, or use reviewed hunk
staging to separate increments. Do not blindly run older phase lists against the
current shared files. Unrelated staged paths are excluded by --only.

~~~powershell
$phase3 = @(
  '.gitignore', 'CONTROLLED_VERIFICATION_REPORT.md', 'MASTER_BUILD_STATUS.md',
  'EXAM_CATALOGUE_LEARNING.md', 'next.config.ts', 'tsconfig.json', 'vitest.config.ts',
  'prisma/schema.prisma',
  'prisma/migrations/20261010000700_learning_editorial/migration.sql',
  'content/launch/jee-neet-foundation-drafts.json',
  'src/app/admin/content', 'src/app/api/admin/content',
  'src/app/api/student/saved-resources', 'src/app/learn',
  'src/app/api/student/content/chapters/[chapterSlug]/lessons/route.ts',
  'src/app/api/student/content/lessons/[lessonSlug]/route.ts',
  'src/components/journey/OperationsWorkspace.tsx',
  'src/components/learning/ContentWorkspace.tsx',
  'src/components/learning/ContentWorkspace.module.css',
  'src/components/learning/SavedResources.tsx',
  'src/screens/Learn.tsx', 'src/screens/learning/LessonExperience.tsx',
  'src/screens/learning/SubjectWorkspace.tsx',
  'src/server/api/admin-handler.ts', 'src/server/api/json-body.ts',
  'src/server/auth/request-security.ts', 'src/server/content',
  'src/server/journey/service.ts', 'src/server/operations/service.ts',
  'src/shared/lesson-content.ts', 'tests/content',
  'tests/student/journey.test.ts', 'tests/student/operations.test.ts'
)
git diff -- $phase3
git diff --cached
git add -- $phase3
git diff --cached -- $phase3
git commit --only -m "Build reviewed catalogue and learning workflows" -- $phase3
git push origin main
~~~

No staging was performed by the agent. Existing index entries are retained.
AGENTS.md/CLAUDE.md remain untracked and unchanged. Git cannot read the user-level
global ignore file in the sandbox; no system or global ignore settings changed.

## Final Git Status

Branch: main. Complete dirty-tree inventory, including preserved earlier work:

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
?? src/app/account/consent/page.tsx
?? src/app/account/guardian-consent/page.tsx
?? src/app/admin/accounts/page.tsx
?? src/app/admin/content/page.tsx
?? src/app/api/account/consent/route.ts
?? src/app/api/account/guardian-consent/route.ts
?? src/app/api/admin/accounts/route.ts
?? src/app/api/admin/content/coverage/route.ts
?? src/app/api/admin/content/import/route.ts
?? src/app/api/admin/content/review/route.ts
?? src/app/api/admin/content/route.ts
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
?? src/server/api/json-body.ts
?? src/server/auth/account-consent.ts
?? src/server/auth/recovery.ts
?? src/server/content/authoring-validation.ts
?? src/server/content/authoring.ts
?? src/server/content/coverage.ts
?? src/server/content/editorial.ts
?? src/server/content/saved-resources.ts
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
?? tests/foundation/postgres-target.test.ts
?? tests/postgres-live/identity.pg.test.ts
?? tests/postgres-live/read-only.setup.ts
?? verification/postgres-target.ts
?? vitest.postgres.config.ts
~~~
