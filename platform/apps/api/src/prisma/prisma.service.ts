import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// ── Token encryption at rest ──────────────────────────────────────────────────
// OAuth access/refresh tokens are encrypted with AES-256-GCM before being written
// to IntegrationAccount and decrypted on read, transparently via Prisma middleware.
// The key comes from ENCRYPTION_KEY (segregated from the database). Values are
// prefixed so the scheme is backward-compatible (legacy plaintext is passed
// through untouched) and idempotent (never double-encrypted).
const ENC_PREFIX = 'enc:v1:';
const ENCRYPTED_FIELDS = ['accessToken', 'refreshToken'] as const;
const KEEPALIVE_INTERVAL_MS = 20 * 60 * 1000;

let cachedKey: Buffer | null | undefined;
function encryptionKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  // Derive a fixed 32-byte key from whatever the operator supplies.
  cachedKey = raw ? createHash('sha256').update(raw).digest() : null;
  return cachedKey;
}

function encryptField(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (value.startsWith(ENC_PREFIX)) return value; // already encrypted
  const key = encryptionKey();
  if (!key) return value; // no key configured → store as-is (dev fallback)
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptField(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) return value;
  const key = encryptionKey();
  if (!key) return value;
  try {
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return value; // corrupt/foreign ciphertext — leave untouched rather than crash
  }
}

function transformData(data: any, fn: (v: unknown) => unknown): void {
  if (!data || typeof data !== 'object') return;
  for (const field of ENCRYPTED_FIELDS) {
    if (field in data) data[field] = fn(data[field]);
  }
}

function decryptResult(result: any): void {
  if (!result || typeof result !== 'object') return;
  if (Array.isArray(result)) {
    for (const row of result) transformData(row, decryptField);
  } else {
    transformData(result, decryptField);
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepaliveFailures = 0;

  async onModuleInit() {
    this.installTokenEncryption();

    if (!encryptionKey()) {
      this.logger.warn(
        'ENCRYPTION_KEY is not set — OAuth tokens are stored in plaintext. ' +
          'Set ENCRYPTION_KEY (segregated from the DB) in every environment.',
      );
    }

    await this.$connect();

    // Azure PostgreSQL Flexible Server (Burstable) can auto-stop after inactivity.
    // The proper fix is to disable auto-stop / right-size the tier in IaC; this
    // heartbeat is a fallback, off by default-overridable, and surfaces failures.
    if (process.env.DB_KEEPALIVE !== 'false') {
      this.keepaliveTimer = setInterval(() => {
        this.$queryRaw`SELECT 1`
          .then(() => {
            this.keepaliveFailures = 0;
          })
          .catch((err) => {
            this.keepaliveFailures += 1;
            const msg = `DB keepalive failed (#${this.keepaliveFailures}) — server may be paused`;
            if (this.keepaliveFailures >= 3) this.logger.error(msg, err);
            else this.logger.warn(msg);
          });
      }, KEEPALIVE_INTERVAL_MS);
    }
  }

  private installTokenEncryption() {
    this.$use(async (params, next) => {
      if (params.model === 'IntegrationAccount') {
        const { action, args } = params;
        if (action === 'create' || action === 'update' || action === 'updateMany') {
          transformData(args?.data, encryptField);
        } else if (action === 'upsert') {
          transformData(args?.create, encryptField);
          transformData(args?.update, encryptField);
        } else if (action === 'createMany') {
          const rows = args?.data;
          if (Array.isArray(rows)) for (const row of rows) transformData(row, encryptField);
        }
      }
      const result = await next(params);
      if (params.model === 'IntegrationAccount') decryptResult(result);
      return result;
    });
  }

  async onModuleDestroy() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    await this.$disconnect();
  }
}
