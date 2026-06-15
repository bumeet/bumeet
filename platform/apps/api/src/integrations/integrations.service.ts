import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { ZoomService } from './zoom.service';
import { WebexService } from './webex.service';

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
    private zoom: ZoomService,
    private webex: WebexService,
  ) {}

  private syncing = false;

  // ── Auto-sync calendars every 5 min ───────────────────────────────────────
  // NOTE: single-instance scheduler. With >1 API instance this should move to a
  // distributed lock (Redis) so the sync doesn't run N times concurrently.
  onModuleInit() {
    setInterval(() => this.syncAllCalendars(), 5 * 60_000); // every 5 min
    setTimeout(() => this.syncAllCalendars(), 5_000);       // initial sync 5 s after boot
  }

  private async syncAllCalendars() {
    if (this.syncing) return; // skip if the previous run hasn't finished
    this.syncing = true;
    try {
      const integrations = await this.prisma.integrationAccount.findMany({
        where: { provider: { in: ['google', 'microsoft', 'zoom', 'webex'] }, status: 'active' },
      });
      await Promise.allSettled(
        integrations.map((i) => {
          if (i.provider === 'google') return this.google.syncEvents(i.id);
          if (i.provider === 'microsoft') return this.microsoft.syncEvents(i.id);
          if (i.provider === 'zoom') return this.zoom.syncEvents(i.id);
          if (i.provider === 'webex') return this.webex.syncEvents(i.id);
        }),
      );
      this.logger.log(`Auto-synced ${integrations.length} calendar integration(s)`);
    } catch (e) {
      this.logger.warn(`Auto-sync error: ${e}`);
    } finally {
      this.syncing = false;
    }
  }

  // ── Unified live status (Slack + Teams + Calendar + Mic + Zoom + Webex) ──────────────────
  async getLiveStatus(userId: string): Promise<LiveStatus> {
    const integrations = await this.getAll(userId);

    const slackIntegrations  = integrations.filter((i) => i.provider === 'slack');
    const teamsIntegrations  = integrations.filter((i) => i.provider === 'teams');
    const msIntegrations     = integrations.filter((i) => i.provider === 'microsoft');
    const zoomIntegrations   = integrations.filter((i) => i.provider === 'zoom');
    const webexIntegrations  = integrations.filter((i) => i.provider === 'webex');
    const hasPresence =
      slackIntegrations.length + teamsIntegrations.length + msIntegrations.length +
      zoomIntegrations.length + webexIntegrations.length > 0;

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
      ...zoomIntegrations.map((i) =>
        this.zoom.getPresence(i.id).then((p) => ({ ...p, _provider: 'zoom' })),
      ),
      ...webexIntegrations.map((i) =>
        this.webex.getPresence(i.id).then((p) => ({ ...p, _provider: 'webex' })),
      ),
    ]);

    // Mic status is fresh if updated within the last 30 s (agent heartbeat every 25 s)
    const micRow = userRow.status === 'fulfilled' ? userRow.value : null;
    const micFresh = micRow?.micUpdatedAt
      && (Date.now() - micRow.micUpdatedAt.getTime() < 30_000);
    const micActive = Boolean(micFresh && micRow?.micActive);

    const providerLabel = (p: string) => {
      switch (p) {
        case 'slack':     return 'Slack';
        case 'teams':     return 'Teams';
        case 'microsoft': return 'Teams';
        case 'zoom':      return 'Zoom';
        case 'webex':     return 'Webex';
        default:          return p;
      }
    };

    // Priority 1: any inCall (Slack / Teams / Microsoft / Zoom / Webex)
    for (const r of presenceResults) {
      if (r.status === 'fulfilled') {
        const v = r.value as any;
        if (v?.inCall) {
          const src = providerLabel(v._provider);
          return { busy: true, upcoming: false, payload: `BUSY · ${src}`, source: src, endAt: null };
        }
      }
    }

    // Priority 2: Teams/Microsoft Busy (Zoom/Webex inCall already caught above)
    // Skip if calendar shows the event is still upcoming — Teams pre-sets presence to Busy
    // a few minutes before meetings start, which would mask the UPCOMING state.
    // DoNotDisturb is intentionally excluded — it's a manual focus state, not an active meeting.
    const calIsUpcoming = calendarResult.status === 'fulfilled' && calendarResult.value.upcoming;
    if (!calIsUpcoming) {
      for (const r of presenceResults) {
        if (r.status === 'fulfilled') {
          const v = r.value as any;
          if (v?.availability === 'Busy') {
            const src = providerLabel(v._provider);
            return { busy: true, upcoming: false, payload: `BUSY · ${src}`, source: src, endAt: null };
          }
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
      const calSourceMap: Record<string, string> = {
        google: 'Google Calendar',
        microsoft: 'Outlook',
        zoom: 'Zoom',
        webex: 'Webex',
      };
      const src = calSourceMap[cal.source ?? ''] ?? (cal.source ?? '');

      // S-02 / S-05: Checks for active (non-upcoming) meetings
      if (!cal.upcoming) {
        const eventStartAt = cal.startAt ? new Date(cal.startAt) : null;
        // mic was active at some point after this event started (and is now off, since Priority 3
        // already returned BUSY·Call when micActive=true — so reaching here means mic is off)
        const micWasUsedDuringEvent = eventStartAt
          && micRow?.micUpdatedAt
          && micRow.micUpdatedAt > eventStartAt;

        // S-02: Left early — mic was used during this event and has since been released
        if (micWasUsedDuringEvent) {
          return { busy: false, upcoming: false, payload: 'FREE', source: null, endAt: null };
        }

        // S-02 fallback: presence signals Available while calendar says BUSY
        const presenceAllFree = hasPresence && presenceResults.every((r) => {
          if (r.status !== 'fulfilled') return true;
          const v = r.value as any;
          return !v?.inCall && !['Busy', 'DoNotDisturb'].includes(v?.availability ?? '');
        });
        if (presenceAllFree) {
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

  getZoomAuthUrl(userId: string): string {
    return this.zoom.getAuthUrl(userId);
  }

  async getZoomPresence(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId, provider: 'zoom' },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.zoom.getPresence(integrationId);
  }

  getWebexAuthUrl(userId: string): string {
    return this.webex.getAuthUrl(userId);
  }

  async getWebexPresence(userId: string, integrationId: string) {
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, userId, provider: 'webex' },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return this.webex.getPresence(integrationId);
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

    // Deleting the integration cascades to its calendarEvents (onDelete: Cascade),
    // so the explicit deleteMany was redundant and non-atomic.
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

    if (integration.provider === 'zoom') {
      await this.zoom.syncEvents(integrationId);
      return this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    }

    if (integration.provider === 'webex') {
      await this.webex.syncEvents(integrationId);
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
