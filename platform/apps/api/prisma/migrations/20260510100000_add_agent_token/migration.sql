ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_agentToken_key" ON "User"("agentToken");
