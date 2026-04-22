-- AlterTable
ALTER TABLE "MessageToDisplay" ADD COLUMN IF NOT EXISTS "permanent" BOOLEAN NOT NULL DEFAULT false;
