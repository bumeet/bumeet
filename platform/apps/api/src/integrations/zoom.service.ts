import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  private readonly AUTH_URL = 'https://zoom.us/oauth/authorize';
  private readonly TOKEN_URL = 'https://zoom.us/oauth/token';
  private readonly API_URL = 'https://api.zoom.us/v2';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get redirectUri() {
    return `${this.config.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/zoom/callback`;
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('ZOOM_CLIENT_ID')!,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: Buffer.from(userId).toString('base64'),
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    const userId = Buffer.from(state, 'base64').toString('utf8');
    const tokens = await this.exchangeCode(code);
    const profile = await this.getProfile(tokens.access_token);

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'zoom' },
    });
    if (count >= 5) throw new Error('Maximum 5 Zoom accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'zoom', providerAccountId: profile.id } },
      update: {
        label: profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'zoom',
        providerAccountId: profile.id,
        label: profile.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
      },
    });

    this.syncEvents(integration.id, tokens.access_token).catch((err) =>
      this.logger.error('Background Zoom sync failed', err),
    );

    return integration;
  }

  async getPresence(integrationId: string): Promise<{ inCall: boolean; status: string }> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    const accessToken = await this.getValidToken(integration);

    const res = await fetch(`${this.API_URL}/users/me/presence_status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      this.logger.warn(`Zoom presence fetch failed: ${res.status}`);
      return { inCall: false, status: 'unknown' };
    }

    const data = await res.json();
    const callStatuses = ['In_Meeting', 'Presenting', 'On_Phone'];
    return {
      inCall: callStatuses.includes(data.status),
      status: data.status ?? 'unknown',
    };
  }

  async syncEvents(integrationId: string, accessTokenOverride?: string): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    const accessToken = accessTokenOverride ?? (await this.getValidToken(integration));

    const allMeetings: any[] = [];
    let nextPageToken: string | undefined;

    do {
      const params = new URLSearchParams({ type: 'upcoming', page_size: '300' });
      if (nextPageToken) params.set('next_page_token', nextPageToken);

      const res = await fetch(`${this.API_URL}/users/me/meetings?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Zoom meetings fetch failed: ${res.status}`);

      const data = await res.json();
      allMeetings.push(...(data.meetings || []));
      nextPageToken = data.next_page_token || undefined;
    } while (nextPageToken);

    let upserted = 0;
    for (const meeting of allMeetings) {
      if (!meeting.id || !meeting.topic) continue;

      const startAt = meeting.start_time ? new Date(meeting.start_time) : null;
      if (!startAt) continue;

      const durationMs = (meeting.duration || 60) * 60 * 1000;
      const endAt = new Date(startAt.getTime() + durationMs);

      await this.prisma.calendarEvent.upsert({
        where: { integrationId_externalId: { integrationId, externalId: String(meeting.id) } },
        update: { title: meeting.topic, startAt, endAt, status: 'confirmed' },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: String(meeting.id),
          title: meeting.topic,
          startAt,
          endAt,
          allDay: false,
          status: 'confirmed',
        },
      });
      upserted++;
    }

    const returnedIds = allMeetings.map((m) => String(m.id)).filter(Boolean);
    if (returnedIds.length > 0) {
      await this.prisma.calendarEvent.deleteMany({
        where: { integrationId, externalId: { notIn: returnedIds } },
      });
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} Zoom meetings for integration ${integrationId}`);
    return upserted;
  }

  private async getValidToken(integration: any): Promise<string> {
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      const refreshed = await this.refreshToken(integration.refreshToken!);
      await this.prisma.integrationAccount.update({
        where: { id: integration.id },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    }
    return integration.accessToken!;
  }

  private async exchangeCode(code: string) {
    const credentials = Buffer.from(
      `${this.config.get('ZOOM_CLIENT_ID')}:${this.config.get('ZOOM_CLIENT_SECRET')}`,
    ).toString('base64');

    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) throw new Error(`Zoom token exchange failed: ${await res.text()}`);
    return res.json();
  }

  private async refreshToken(refreshToken: string) {
    const credentials = Buffer.from(
      `${this.config.get('ZOOM_CLIENT_ID')}:${this.config.get('ZOOM_CLIENT_SECRET')}`,
    ).toString('base64');

    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    if (!res.ok) throw new Error(`Zoom token refresh failed: ${await res.text()}`);
    return res.json();
  }

  private async getProfile(accessToken: string) {
    const res = await fetch(`${this.API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Zoom profile fetch failed: ${await res.text()}`);
    return res.json();
  }
}
