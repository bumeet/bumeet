/**
 * Google Calendar integration — OAuth2 flow + event sync.
 *
 * Flow:
 *  1. getAuthUrl(userId)  → redirect URL to Google consent screen
 *  2. handleCallback(code, userId) → exchange code for tokens, store, sync events
 *  3. syncEvents(integrationId) → pull events from Google Calendar API into DB
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private createOAuthClient() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      `${this.config.get('FRONTEND_URL') === 'http://localhost:3000' ? 'http://localhost:3001' : this.config.get('FRONTEND_URL')}/api/v1/auth/google/callback`,
    );
  }

  getAuthUrl(userId: string): string {
    const oauth2Client = this.createOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      state: Buffer.from(userId).toString('base64'),
    });
  }

  async handleCallback(code: string, state: string) {
    const userId = Buffer.from(state, 'base64').toString('utf8');

    const oauth2Client = this.createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get Google user info to use as providerAccountId
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'google' },
    });
    if (count >= 5) throw new Error('Maximum 5 Google accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'google', providerAccountId: googleUser.id! } },
      update: {
        label: googleUser.email ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'google',
        providerAccountId: googleUser.id!,
        label: googleUser.email ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        status: 'active',
      },
    });

    // Sync events in the background
    this.syncEvents(integration.id, oauth2Client).catch((err) =>
      this.logger.error('Background sync failed', err),
    );

    return integration;
  }

  async syncEvents(integrationId: string, existingClient?: any): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({
      where: { id: integrationId },
    });
    if (!integration || !integration.accessToken) throw new Error('Integration not found or no access token');

    const oauth2Client = existingClient ?? this.createOAuthClient();
    if (!existingClient) {
      oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiresAt?.getTime(),
      });
    }

    // Auto-refresh token if expired
    oauth2Client.on('tokens', async (tokens: any) => {
      if (tokens.access_token) {
        await this.prisma.integrationAccount.update({
          where: { id: integrationId },
          data: {
            accessToken: tokens.access_token,
            tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          },
        });
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Sync events from now - 7 days to now + 60 days
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    let allEvents: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      });

      allEvents = allEvents.concat(res.data.items || []);
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    // Upsert events into DB
    let upserted = 0;
    for (const event of allEvents) {
      if (!event.id || !event.summary) continue;

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
          title: event.summary,
          description: event.description ?? null,
          startAt,
          endAt,
          allDay: !event.start?.dateTime,
          location: event.location ?? null,
          status: event.status ?? 'confirmed',
        },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: event.id,
          title: event.summary,
          description: event.description ?? null,
          startAt,
          endAt,
          allDay: !event.start?.dateTime,
          location: event.location ?? null,
          status: event.status ?? 'confirmed',
        },
      });
      upserted++;
    }

    // Remove cancelled/deleted events no longer returned by Google
    const returnedIds = allEvents.map((e) => e.id).filter(Boolean) as string[];
    if (returnedIds.length > 0) {
      await this.prisma.calendarEvent.deleteMany({
        where: {
          integrationId,
          externalId: { notIn: returnedIds },
        },
      });
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} events for integration ${integrationId}`);
    return upserted;
  }
}
