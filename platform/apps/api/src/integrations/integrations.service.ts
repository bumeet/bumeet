import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';

export interface LiveStatus {
  busy: boolean;
  upcoming: boolean;     // true = meeting starts within 5 min but hasn't started yet
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
    setInterval(() => this.syncAllCalendars(), 60_000);  // every 60 s
    setTimeout(() => this.syncAllCalendars(), 5_000);    // initial sync 5 s after boot
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

  // ── Unified live status (Slack + Teams + Calendar + Mic) ──────────────────
  async getLiveStatus(userId: string): Promise<LiveStatus> {
    const integrations = await this.getAll(userId);

    const slackIntegrations = integrations.filter((i) => i.provider === 'slack');
    const teamsIntegrations = integrations.filter((i) => i.provider === 'teams');
    const msIntegrations    = integrations.filter((i) => i.provider === 'microsoft');
    const hasPresence = slackIntegrations.length + teamsIntegrations.length + msIntegrations.length > 0;

    // Fetch mic status and all remote checks in parallel
    const [userRow, calendarResult, ...presenceResults] = await Promise.allSettled([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { micActive: true, micUpdatedAt: true },
      }),
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

    // Mic status is fresh if updated within the last 30 s (agent heartbeat every 25 s)
    const micRow = userRow.status === 'fulfilled' ? userRow.value : null;
    const micFresh = micRow?.micUpdatedAt
      && (Date.now() - micRow.micUpdatedAt.getTime() < 30_000);
    const micActive = Boolean(micFresh && micRow?.micActive);

    // Priority 1: any inCall (Slack / Teams / Microsoft)
    for (const r of presenceResults) {
      if (r.status === 'fulfilled') {
        const v = r.value as any;
        if (v?.inCall) {
          const src = v._provider === 'slack' ? 'Slack' : 'Teams';
          return { busy: true, upcoming: false, payload: `BUSY · ${src}`, source: src, endAt: null };
        }
      }
    }

    // Priority 2: Teams/Microsoft Busy or DoNotDisturb
    for (const r of presenceResults) {
      if (r.status === 'fulfilled') {
        const v = r.value as any;
        if (['Busy', 'DoNotDisturb'].includes(v?.availability ?? '')) {
          const src = v._provider === 'slack' ? 'Slack' : 'Teams';
          return { busy: true, upcoming: false, payload: `BUSY · ${src}`, source: src, endAt: null };
        }
      }
    }

    // Priority 3: Microphone in use (desktop agent, any app — Google Meet, Zoom, FaceTime…)
    // This resolves early-meeting-end: when the user hangs up, the mic is released immediately,
    // even if the calendar event still has time remaining.
    if (micActive) {
      return { busy: true, upcoming: false, payload: 'BUSY · Call', source: 'Mic', endAt: null };
    }

    // Priority 4: Calendar event
    if (calendarResult.status === 'fulfilled' && calendarResult.value.busy) {
      const cal = calendarResult.value;
      const src = (cal.source ?? '').replace('google', 'Google Calendar').replace('microsoft', 'Outlook');

      // S-02: Active meeting but mic is OFF and Slack/Teams say Available → user left early
      if (!cal.upcoming) {
        const micJustStopped = micRow?.micUpdatedAt
          && (Date.now() - micRow.micUpdatedAt.getTime() < 120_000)
          && !micRow.micActive;
        const presenceAllFree = hasPresence && presenceResults.every((r) => {
          if (r.status !== 'fulfilled') return true;
          const v = r.value as any;
          return !v?.inCall && !['Busy', 'DoNotDisturb'].includes(v?.availability ?? '');
        });
        if (micJustStopped || presenceAllFree) {
          return { busy: false, upcoming: false, payload: 'FREE', source: null, endAt: null };
        }
      }

      // S-01: Upcoming meeting (starts within next 5 min)
      if (cal.upcoming && cal.startAt) {
        try {
          const dt = new Date(cal.startAt);
          const startStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
          const payload = src ? `UPCOMING · ${src} · starts ${startStr}` : `UPCOMING · starts ${startStr}`;
          return { busy: false, upcoming: true, payload, source: cal.source, endAt: null };
        } catch { /* ignore */ }
      }

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
      return { busy: true, upcoming: false, payload, source: cal.source, endAt: cal.endAt };
    }

    return { busy: false, upcoming: false, payload: 'FREE', source: null, endAt: null };
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

  /** Returns whether the user has an active or upcoming (≤5 min) calendar event. */
  async getBusyStatus(userId: string): Promise<{ busy: boolean; upcoming: boolean; reason: string | null; source: string | null; endAt: string | null; startAt: string | null }> {
    const now = new Date();
    const lookahead = new Date(now.getTime() + 5 * 60 * 1000); // S-01: 5-min pre-meeting window
    const event = await this.prisma.calendarEvent.findFirst({
      where: {
        userId,
        allDay: false,          // S-04: skip all-day events (out-of-office, holidays, etc.)
        startAt: { lte: lookahead },
        endAt: { gt: now },
        status: 'confirmed',
      },
      include: { integration: { select: { provider: true } } },
      orderBy: { startAt: 'asc' }, // nearest event first
    });

    if (event) {
      const upcoming = event.startAt > now; // S-01: true = meeting hasn't started yet
      return {
        busy: true,
        upcoming,
        reason: event.title,
        source: event.integration.provider,
        endAt: event.endAt.toISOString(),
        startAt: event.startAt.toISOString(),
      };
    }

    return { busy: false, upcoming: false, reason: null, source: null, endAt: null, startAt: null };
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
