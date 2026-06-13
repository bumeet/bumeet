import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthStateService } from './oauth-state.service';

@Injectable()
export class WebexService {
  private readonly logger = new Logger(WebexService.name);

  private readonly AUTH_URL = 'https://webexapis.com/v1/authorize';
  private readonly TOKEN_URL = 'https://webexapis.com/v1/access_token';
  private readonly API_URL = 'https://webexapis.com/v1';
  private readonly SCOPES = 'spark:people_read spark:rooms_read meeting:schedules_read';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private oauthState: OAuthStateService,
  ) {}

  private get redirectUri() {
    return `${this.config.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/webex/callback`;
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('WEBEX_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: this.SCOPES,
      state: this.oauthState.issue(userId),
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    const userId = this.oauthState.consume(state);
    const tokens = await this.exchangeCode(code);
    const profile = await this.getProfile(tokens.access_token);

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'webex' },
    });
    if (count >= 5) throw new Error('Maximum 5 Webex accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'webex', providerAccountId: profile.id } },
      update: {
        label: profile.emails?.[0] ?? profile.displayName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'webex',
        providerAccountId: profile.id,
        label: profile.emails?.[0] ?? profile.displayName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
      },
    });

    this.syncEvents(integration.id, tokens.access_token).catch((err) =>
      this.logger.error('Background Webex sync failed', err),
    );

    return integration;
  }

  async getPresence(integrationId: string): Promise<{ inCall: boolean; status: string }> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    const accessToken = await this.getValidToken(integration);

    const res = await fetch(`${this.API_URL}/people/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      this.logger.warn(`Webex presence fetch failed: ${res.status}`);
      return { inCall: false, status: 'unknown' };
    }

    const data = await res.json();
    const callStatuses = ['meeting', 'call', 'presenting', 'sharing'];
    return {
      inCall: callStatuses.includes(data.status),
      status: data.status ?? 'unknown',
    };
  }

  async syncEvents(integrationId: string, accessTokenOverride?: string): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    const accessToken = accessTokenOverride ?? (await this.getValidToken(integration));

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const allMeetings: any[] = [];
    let start = 1;
    const max = 100;

    while (true) {
      const params = new URLSearchParams({
        meetingType: 'meeting',
        from,
        to,
        max: String(max),
        start: String(start),
      });
      const res = await fetch(`${this.API_URL}/meetings?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        this.logger.warn(`Webex meetings fetch failed: ${res.status}`);
        break;
      }

      const data = await res.json();
      const meetings: any[] = data.items || [];
      allMeetings.push(...meetings);

      if (meetings.length < max) break;
      start += max;
    }

    let upserted = 0;
    for (const meeting of allMeetings) {
      if (!meeting.id || !meeting.title) continue;

      const startAt = meeting.start ? new Date(meeting.start) : null;
      const endAt = meeting.end ? new Date(meeting.end) : null;
      if (!startAt || !endAt) continue;

      await this.prisma.calendarEvent.upsert({
        where: { integrationId_externalId: { integrationId, externalId: meeting.id } },
        update: { title: meeting.title, startAt, endAt, status: 'confirmed' },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: meeting.id,
          title: meeting.title,
          startAt,
          endAt,
          allDay: false,
          status: 'confirmed',
        },
      });
      upserted++;
    }

    const returnedIds = allMeetings.map((m) => m.id).filter(Boolean);
    if (returnedIds.length > 0) {
      await this.prisma.calendarEvent.deleteMany({
        where: { integrationId, externalId: { notIn: returnedIds } },
      });
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} Webex meetings for integration ${integrationId}`);
    return upserted;
  }

  private async getValidToken(integration: any): Promise<string> {
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date() && integration.refreshToken) {
      const refreshed = await this.refreshToken(integration.refreshToken);
      await this.prisma.integrationAccount.update({
        where: { id: integration.id },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : undefined,
        },
      });
      return refreshed.access_token;
    }
    return integration.accessToken!;
  }

  private async exchangeCode(code: string) {
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('WEBEX_CLIENT_ID')!,
        client_secret: this.config.get('WEBEX_CLIENT_SECRET')!,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Webex token exchange failed: ${await res.text()}`);
    return res.json();
  }

  private async refreshToken(refreshToken: string) {
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('WEBEX_CLIENT_ID')!,
        client_secret: this.config.get('WEBEX_CLIENT_SECRET')!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Webex token refresh failed: ${await res.text()}`);
    return res.json();
  }

  private async getProfile(accessToken: string) {
    const res = await fetch(`${this.API_URL}/people/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Webex profile fetch failed: ${await res.text()}`);
    return res.json();
  }
}
