-- Drop the old 2-field unique index (userId, provider)
DROP INDEX IF EXISTS "IntegrationAccount_userId_provider_key";

-- Create the correct 3-field unique index (userId, provider, providerAccountId)
-- This is what the Prisma schema @@unique([userId, provider, providerAccountId]) expects
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationAccount_userId_provider_providerAccountId_key"
  ON "IntegrationAccount"("userId", "provider", "providerAccountId");
