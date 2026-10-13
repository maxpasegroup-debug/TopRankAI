-- Preserve legacy rows for explicit review; never infer or backfill consent.
-- NOT VALID still enforces these guards on newly inserted or updated rows.
ALTER TABLE "SchoolEnrollment" ADD CONSTRAINT "SchoolEnrollment_active_scopes_check" CHECK (
  "status"::text <> 'ACTIVE' OR (
    "scopes" IS NOT NULL AND cardinality("scopes") BETWEEN 1 AND 6 AND
    CASE WHEN array_ndims("scopes") = 1 THEN
      array_position("scopes", NULL::text) IS NULL AND
      "scopes" <@ ARRAY['ACTIVITY', 'MOCKS', 'ACHIEVEMENTS', 'ANNOUNCEMENTS', 'SUPPORT', 'COUNSELLING']::text[]
    ELSE FALSE END
  )
) NOT VALID;

ALTER TABLE "StudentParentRelationship" ADD CONSTRAINT "Guardian_active_scopes_check" CHECK (
  "status"::text <> 'ACTIVE' OR (
    "scopes" IS NOT NULL AND cardinality("scopes") BETWEEN 1 AND 4 AND
    CASE WHEN array_ndims("scopes") = 1 THEN
      array_position("scopes", NULL::text) IS NULL AND
      "scopes" <@ ARRAY['ACTIVITY', 'MOCKS', 'ACHIEVEMENTS', 'ANNOUNCEMENTS']::text[]
    ELSE FALSE END
  )
) NOT VALID;
