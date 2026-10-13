-- Free pilot packages do not create orders, payments or receipts.
-- Keep all positive-money financial constraints and immutable-term triggers intact.
BEGIN;
ALTER TABLE "CommercePackage" DROP CONSTRAINT "CommercePackage_terms_check";
ALTER TABLE "CommercePackage" ADD CONSTRAINT "CommercePackage_terms_check" CHECK (
  "revision" > 0 AND "amountMinor" BETWEEN 0 AND 100000000 AND "currency" = 'INR'
  AND "durationDays" BETWEEN 1 AND 3660 AND "availableUntil" > "availableFrom"
  AND "interval" IN ('ONCE', 'MONTH', 'YEAR') AND "status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')
  AND ("amountMinor" > 0 OR "interval" = 'ONCE')
  AND cardinality("features") BETWEEN 1 AND 30);
COMMIT;
