import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';

export interface LiveStatus {
  busy: boolean;
  payload: string;       // ready to send to CoreInk
  source: string | null;
  endAt: string | null;
}

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private google: GoogleCalendarService,
    private microsoft: MicrosoftCalendarService,
    private slack: SlackService,
    private teams: TeamsService,
  ) {}

  // ── Auto-sync calendars every 15 min ──────────────────────────────────────
  onModuleInit() {
    const INTERVAL = 15 * 60 * 1000;
    setInterval(() => this.syncAllCalendars(), INTERVAL);
    // Initial sync after 30 s to avoid slowing down startup
    setTimeout(() => this.syncAllCalendars(), 30_000);
  }

  private async syncAllCalendars() {
    try {
      const integrations = await this.prisma.integrationAccount.findMany({
        where: { provider: { in: ['google', 'microsoft'] }, status: 'active' },
      });
      await Promise.allSettled(
        integrations.map((i) =>
          i.provider === 'google'
            ? this.google.syncEvents(i.id)
            : this.microsoft.syncEvents(i.id),
        ),
      );
      this.logger.log(`Auto-synced ${integrations.length} calendar integration(s)`);
    } catch (e) {
      this.logger.warn(`Auto-sync error: ${e}`);
    }
  }

  // ── Unified live status (Slack + Teams + Calendar) ─────────────────────────
  async getLiveStatus(userId: string): Promise<LiveStatus> {
    const integrations = await this.getAll(userId);

    const slackIntegrations   = integrations.filter((i) => i.provider === 'slack');
    const teamsIntegrations   = integrations.filter((i) => i.provider === 'teams');
    const msIntegrations      = integrations.filter((i) => i.provider === 'microsoft');

    const [calendarResult, ...presenceResults] = await Promise.allSettled([
      this.getBusyStatus(userId),
      ...slackIntegrations.map((i) =>
        this.slack.getPresence(i.id).then((p) => ({ ...p, _provider: 'slack' })),
      ),
      ...teamsIntegrations.map((i) =>
        this.teams.getPresence(i.id).then((p) => ({ ...p, _provider: 'teams' })),
      ),
      ...msIntegrations.map((i) =>
        this.microsoft.getPresence(i.id).then((p) => ({ ...p, _provider: 'microsoft' })),
      ),
    ]);

    // Priority 1: any inCall (Slack / Teams / Microsoft)
    for (const r of presenceResults) {
      if (r.status === 'fulfilled' && r.value?.inCall) {
        const src = r.value._provider === 'slack' ? 'Slack' : 'Teams';
        return { busy: true, payload: `BUSY · ${src}`, source: src, endAt: null };
      }
    }

    // Priority 2: Teams/Microsoft Busy or DoNotDisturb availability
    for (const r of presenceResults) {
      if (
        r.status === 'fulfilled' &&
        ['Busy', 'DoNotDisturb'].includes(r.value?.availability ?? '')
      ) {
        const src = r.value._provider === 'slack' ? 'Slack' : 'Teams';
        return { busy: true, payload: `BUSY · ${src}`, source: src, endAt: null };
      }
    }

    // Priority 3: Calendar event
    if (calendarResult.status === 'fulfilled' && calendarResult.value.busy) {
      const cal = calendarResult.value;
      const src = (cal.source ?? '').replace('google', 'Google Calendar').replace('microsoft', 'Outlook');
      let endStr = '';
      if (cal.endAt) {
        try {
          const dt = new Date(cal.endAt);
          endStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
        } catch { /* ignore */ }
      }
      const payload = src && endStr
        ? `BUSY · ${src} · ends ${endStr}`
        : src ? `BUSY · ${src}` : 'BUSY';
      return { busy: true, payload, source: cal.source, endAt: cal.endAt };
    }

    return { busy: false, payload: 'FREE', source: null, endAt: null };
  }

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

  getTeamsAuthUrl(userId: string): string {
    return this.teams.getAuthUrl(userId);
  }

  async getTeamsPresence(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId, provider: 'teams' },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.teams.getPresence(integrationId);
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

  /** Returns whether the user has an active calendar event right now. */
  async getBusyStatus(userId: string): Promise<{ busy: boolean; reason: string | null; source: string | null; endAt: string | null }> {
    const now = new Date();
    const event = await this.prisma.calendarEvent.findFirst({
      where: {
        userId,
        startAt: { lte: now },
        endAt: { gt: now },
        status: 'confirmed',
      },
      include: { integration: { select: { provider: true } } },
      orderBy: { startAt: 'desc' },
    });

    if (event) {
      return {
        busy: true,
        reason: event.title,
        source: event.integration.provider,
        endAt: event.endAt.toISOString(),
      };
    }

    return { busy: false, reason: null, source: null, endAt: null };
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
