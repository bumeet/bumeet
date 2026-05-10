-- AlterTable: BLE device config per user
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bleDeviceAddress" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bleCharacteristicUuid" TEXT;
