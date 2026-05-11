import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Azure PostgreSQL Flexible Server (Burstable tier) auto-pauses after inactivity.
// A periodic ping every 20 min keeps the server alive without any cost overhead.
const KEEPALIVE_INTERVAL_MS = 20 * 60 * 1000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  async onModuleInit() {
    await this.$connect();
    this.keepaliveTimer = setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch (err) {
        this.logger.warn('DB keepalive failed — server may be paused', err);
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    await this.$disconnect();
  }
}
