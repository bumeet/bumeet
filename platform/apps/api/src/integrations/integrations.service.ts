import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';

@Injectable()
export class IntegrationsService {
  constructor(
    private prisma: PrismaService,
    private google: GoogleCalendarService,
    private microsoft: MicrosoftCalendarService,
    private slack: SlackService,
  ) {}

  async getAll(userId: string) {
    return this.prisma.integrationAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Fallback demo connection for providers without real OAuth. */
  async connectDemo(userId: string, provider: string) {
    return this.prisma.integrationAccount.create({
      data: {
        userId,
        provider,
        providerAccountId: `demo-${provider}-${Date.now()}`,
        status: 'active',
        lastSyncAt: new Date(),
        eventsImported: Math.floor(Math.random() * 30) + 5,
      },
    });
  }

  getGoogleAuthUrl(userId: string): string {
    return this.google.getAuthUrl(userId);
  }

  getMicrosoftAuthUrl(userId: string): string {
    return this.microsoft.getAuthUrl(userId);
  }

  async getMicrosoftPresence(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId, provider: 'microsoft' },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.microsoft.getPresence(integrationId);
  }

  getSlackAuthUrl(userId: string): string {
    return this.slack.getAuthUrl(userId);
  }

  async getSlackPresence(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId, provider: 'slack' },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.slack.getPresence(integrationId);
  }

  async disconnect(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    await this.prisma.calendarEvent.deleteMany({ where: { integrationId } });
    await this.prisma.integrationAccount.delete({ where: { id: integrationId } });
    return { success: true };
  }

  async triggerSync(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    if (integration.provider === 'google') {
      await this.google.syncEvents(integrationId);
      return this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    }

    if (integration.provider === 'microsoft') {
      await this.microsoft.syncEvents(integrationId);
      return this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    }

    if (integration.provider === 'slack') {
      await this.slack.syncEvents(integrationId);
      return this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    }

    // Fallback demo sync
    return this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        eventsImported: integration.eventsImported + Math.floor(Math.random() * 5),
        status: 'active',
        errorMessage: null,
      },
    });
  }
}
