ALTER TABLE "User" ADD COLUMN "pinHash" TEXT,
  ADD COLUMN "pinVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_pinVersion_nonnegative" CHECK ("pinVersion" >= 0);

CREATE TABLE "EmailOtpChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL CHECK ("purpose" IN ('SIGNUP','RESET')),
  "email" TEXT NOT NULL,
  "bindingHash" TEXT,
  "codeHash" TEXT NOT NULL,
  "proofHash" TEXT,
  "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "pinVersion" INTEGER,
  "deliveryState" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("deliveryState" IN ('PENDING','SENT','FAILED')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "EmailOtpChallenge_proof" CHECK ("verifiedAt" IS NULL OR "proofHash" IS NOT NULL)
);
CREATE UNIQUE INDEX "EmailOtpChallenge_tokenHash_key" ON "EmailOtpChallenge"("tokenHash");
CREATE INDEX "EmailOtpChallenge_email_purpose_createdAt_idx" ON "EmailOtpChallenge"("email","purpose","createdAt");
CREATE INDEX "EmailOtpChallenge_expiresAt_idx" ON "EmailOtpChallenge"("expiresAt");
CREATE TABLE "PinAttemptWindow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0 CHECK ("count" BETWEEN 0 AND 10),
  "endsAt" TIMESTAMP(3) NOT NULL
);
