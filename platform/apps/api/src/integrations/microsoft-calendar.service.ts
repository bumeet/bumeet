/**
 * Microsoft Calendar integration — OAuth2 + Microsoft Graph API.
 *
 * Syncs Outlook/Exchange calendar events via Graph calendarView endpoint.
 * Token refresh is handled automatically on each sync.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MicrosoftCalendarService {
  private readonly logger = new Logger(MicrosoftCalendarService.name);

  private readonly AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private readonly TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly GRAPH_URL = 'https://graph.microsoft.com/v1.0';
  private readonly SCOPES = 'openid email profile offline_access User.Read Calendars.Read';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get redirectUri() {
    return 'http://localhost:3001/api/v1/auth/microsoft/callback';
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('MICROSOFT_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.SCOPES,
      response_mode: 'query',
      state: Buffer.from(userId).toString('base64'),
      prompt: 'consent',
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    const userId = Buffer.from(state, 'base64').toString('utf8');

    const tokens = await this.exchangeCode(code);
    const profile = await this.getProfile(tokens.access_token);

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'microsoft' },
    });
    if (count >= 5) throw new Error('Maximum 5 Microsoft accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'microsoft', providerAccountId: profile.id } },
      update: {
        label: profile.mail ?? profile.userPrincipalName ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'microsoft',
        providerAccountId: profile.id,
        label: profile.mail ?? profile.userPrincipalName ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        status: 'active',
      },
    });

    this.syncEvents(integration.id, tokens.access_token).catch((err) =>
      this.logger.error('Background MS sync failed', err),
    );

    return integration;
  }

  async syncEvents(integrationId: string, accessTokenOverride?: string): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new Error('Integration not found');

    let accessToken = accessTokenOverride ?? integration.accessToken!;

    // Refresh token if expired
    if (!accessTokenOverride && integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      const refreshed = await this.refreshToken(integration.refreshToken!);
      accessToken = refreshed.access_token;
      await this.prisma.integrationAccount.update({
        where: { id: integrationId },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const events = await this.fetchAllEvents(accessToken, timeMin, timeMax);

    let upserted = 0;
    for (const event of events) {
      if (!event.id || !event.subject) continue;

      const startAt = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : null;
      const endAt = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : null;

      if (!startAt || !endAt) continue;

      await this.prisma.calendarEvent.upsert({
        where: { integrationId_externalId: { integrationId, externalId: event.id } },
        update: {
          title: event.subject,
          description: event.bodyPreview ?? null,
          startAt,
          endAt,
          allDay: event.isAllDay ?? false,
          location: event.location?.displayName ?? null,
          status: event.isCancelled ? 'cancelled' : 'confirmed',
        },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: event.id,
          title: event.subject,
          description: event.bodyPreview ?? null,
          startAt,
          endAt,
          allDay: event.isAllDay ?? false,
          location: event.location?.displayName ?? null,
          status: event.isCancelled ? 'cancelled' : 'confirmed',
        },
      });
      upserted++;
    }

    const returnedIds = events.map((e) => e.id).filter(Boolean);
    if (returnedIds.length > 0) {
      await this.prisma.calendarEvent.deleteMany({
        where: { integrationId, externalId: { notIn: returnedIds } },
      });
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} MS events for integration ${integrationId}`);
    return upserted;
  }

  private async fetchAllEvents(accessToken: string, startDateTime: string, endDateTime: string) {
    const allEvents: any[] = [];
    let url: string | null =
      `${this.GRAPH_URL}/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}` +
      `&$select=id,subject,bodyPreview,start,end,location,isAllDay,isCancelled` +
      `&$top=250&$orderby=start/dateTime`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      allEvents.push(...(data.value || []));
      url = data['@odata.nextLink'] ?? null;
    }

    return allEvents;
  }

  private async exchangeCode(code: string) {
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('MICROSOFT_CLIENT_ID')!,
        client_secret: this.config.get('MICROSOFT_CLIENT_SECRET')!,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`MS token exchange failed: ${await res.text()}`);
    return res.json();
  }

  private async refreshToken(refreshToken: string) {
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('MICROSOFT_CLIENT_ID')!,
        client_secret: this.config.get('MICROSOFT_CLIENT_SECRET')!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: this.SCOPES,
      }),
    });
    if (!res.ok) throw new Error(`MS token refresh failed: ${await res.text()}`);
    return res.json();
  }

  async getPresence(integrationId: string): Promise<{ availability: string; activity: string; busy: boolean }> {
    const integration = await this.prisma.integrationAccount.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new Error('Integration not found');

    let accessToken = integration.accessToken!;

    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      const refreshed = await this.refreshToken(integration.refreshToken!);
      accessToken = refreshed.access_token;
      await this.prisma.integrationAccount.update({
        where: { id: integrationId },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const res = await fetch(`${this.GRAPH_URL}/me/presence`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Graph presence fetch failed: ${await res.text()}`);

    const data = await res.json();
    const busyStates = ['Busy', 'BusyIdle', 'DoNotDisturb', 'InACall', 'InAMeeting'];

    return {
      availability: data.availability ?? 'Unknown',
      activity: data.activity ?? 'Unknown',
      busy: busyStates.includes(data.availability),
    };
  }

  private async getProfile(accessToken: string) {
    const res = await fetch(`${this.GRAPH_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Graph profile fetch failed: ${await res.text()}`);
    return res.json();
  }
}
