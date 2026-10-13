CREATE TABLE "GuardianRegistrationGrant" (
 "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "childEmailHash" TEXT NOT NULL,
 "country" TEXT NOT NULL, "policyVersion" TEXT NOT NULL, "guardianId" TEXT NOT NULL,
 "verifiedById" TEXT NOT NULL, "verificationReference" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), CONSTRAINT "GuardianRegistrationGrant_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "GuardianRegistrationGrant_country_check" CHECK ("country" IN ('IN','AE')),
 CONSTRAINT "GuardianRegistrationGrant_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$' AND "childEmailHash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "GuardianRegistrationGrant_expiry_check" CHECK ("expiresAt" > "verifiedAt")
);
CREATE TABLE "AccountConsent" (
 "userId" TEXT NOT NULL, "country" TEXT NOT NULL, "ageBand" TEXT NOT NULL,
 "termsVersion" TEXT NOT NULL, "privacyVersion" TEXT NOT NULL,
 "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), "guardianGrantId" TEXT,
 CONSTRAINT "AccountConsent_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "AccountConsent_country_check" CHECK ("country" IN ('IN','AE')),
 CONSTRAINT "AccountConsent_age_check" CHECK ("ageBand" IN ('UNDER_13','13_TO_17','18_PLUS')),
 CONSTRAINT "AccountConsent_guardian_check" CHECK ("ageBand"='18_PLUS' OR "guardianGrantId" IS NOT NULL)
);
CREATE TABLE "PasswordReset" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deliveryPayload" TEXT, "deliveryState" TEXT NOT NULL DEFAULT 'PENDING', "deliveryAttempts" INTEGER NOT NULL DEFAULT 0, "deliveryLeaseUntil" TIMESTAMP(3),
 CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PasswordReset_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "PasswordReset_expiry_check" CHECK ("expiresAt" > "createdAt"),
 CONSTRAINT "PasswordReset_delivery_check" CHECK ("deliveryState" IN ('PENDING','SENT','FAILED') AND "deliveryAttempts" BETWEEN 0 AND 3)
);
CREATE UNIQUE INDEX "GuardianRegistrationGrant_tokenHash_key" ON "GuardianRegistrationGrant"("tokenHash");
CREATE INDEX "GuardianRegistrationGrant_guardianId_revokedAt_idx" ON "GuardianRegistrationGrant"("guardianId","revokedAt");
CREATE INDEX "GuardianRegistrationGrant_expiresAt_idx" ON "GuardianRegistrationGrant"("expiresAt");
CREATE UNIQUE INDEX "AccountConsent_guardianGrantId_key" ON "AccountConsent"("guardianGrantId");
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
CREATE INDEX "PasswordReset_userId_expiresAt_idx" ON "PasswordReset"("userId","expiresAt");
CREATE INDEX "PasswordReset_deliveryState_expiresAt_idx" ON "PasswordReset"("deliveryState","expiresAt");
CREATE UNIQUE INDEX "PasswordReset_one_pending" ON "PasswordReset"("userId") WHERE "consumedAt" IS NULL;
ALTER TABLE "GuardianRegistrationGrant" ADD CONSTRAINT "GuardianRegistrationGrant_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianRegistrationGrant" ADD CONSTRAINT "GuardianRegistrationGrant_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountConsent" ADD CONSTRAINT "AccountConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountConsent" ADD CONSTRAINT "AccountConsent_guardianGrantId_fkey" FOREIGN KEY ("guardianGrantId") REFERENCES "GuardianRegistrationGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
