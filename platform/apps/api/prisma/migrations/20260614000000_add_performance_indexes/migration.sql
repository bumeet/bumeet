-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationAccount_userId_idx" ON "IntegrationAccount"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_startAt_idx" ON "CalendarEvent"("userId", "startAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_integrationId_idx" ON "CalendarEvent"("integrationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageToDisplay_userId_createdAt_idx" ON "MessageToDisplay"("userId", "createdAt");
