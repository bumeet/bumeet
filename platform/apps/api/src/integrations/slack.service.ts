/**
 * Slack integration — OAuth2 + Slack Web API.
 *
 * Connects a Slack workspace and imports channel messages/huddles as calendar-like events.
 * Token refresh: Slack tokens don't expire unless revoked, so no refresh logic needed.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  private readonly AUTH_URL = 'https://slack.com/oauth/v2/authorize';
  private readonly TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
  private readonly API_URL = 'https://slack.com/api';

  // Bot scopes (scope param) + user scopes (user_scope param)
  private readonly SCOPES = 'channels:history,im:history,users:read';
  private readonly USER_SCOPES = 'identity.basic,identity.email,users.profile:read';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get redirectUri() {
    return `${this.config.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/slack/callback`;
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('SLACK_CLIENT_ID')!,
      scope: this.SCOPES,
      user_scope: this.USER_SCOPES,
      redirect_uri: this.redirectUri,
      state: Buffer.from(userId).toString('base64'),
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    const userId = Buffer.from(state, 'base64').toString('utf8');

    const tokens = await this.exchangeCode(code);
    const profile = await this.getProfile(tokens.authed_user?.access_token ?? tokens.access_token);

    const providerAccountId = tokens.authed_user?.id ?? profile.user?.id;
    const label = profile.user?.email ?? profile.user?.name ?? undefined;

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'slack' },
    });
    if (count >= 5) throw new Error('Maximum 5 Slack accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'slack', providerAccountId } },
      update: {
        label,
        accessToken: tokens.authed_user?.access_token ?? tokens.access_token,
        refreshToken: null,
        tokenExpiresAt: null,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'slack',
        providerAccountId,
        label,
        accessToken: tokens.authed_user?.access_token ?? tokens.access_token,
        refreshToken: null,
        tokenExpiresAt: null,
        status: 'active',
      },
    });

    this.syncEvents(integration.id).catch((err) =>
      this.logger.error('Background Slack sync failed', err),
    );

    return integration;
  }

  async syncEvents(integrationId: string): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new Error('Integration not found');

    const accessToken = integration.accessToken!;

    // Fetch IM (direct message) history as a proxy for availability events
    const oldest = String(Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000));

    const messages = await this.fetchImMessages(accessToken, oldest);

    let upserted = 0;
    for (const msg of messages) {
      if (!msg.ts || msg.subtype === 'bot_message') continue;
      if (msg.type !== 'message') continue;

      const startAt = new Date(parseFloat(msg.ts) * 1000);
      const endAt = new Date(startAt.getTime() + 5 * 60 * 1000); // 5-min window

      await this.prisma.calendarEvent.upsert({
        where: { integrationId_externalId: { integrationId, externalId: msg.ts } },
        update: {
          title: msg.text ? msg.text.slice(0, 100) : 'Slack message',
          startAt,
          endAt,
          status: 'confirmed',
        },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: msg.ts,
          title: msg.text ? msg.text.slice(0, 100) : 'Slack message',
          startAt,
          endAt,
          allDay: false,
          status: 'confirmed',
        },
      });
      upserted++;
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} Slack events for integration ${integrationId}`);
    return upserted;
  }

  private async fetchImMessages(accessToken: string, oldest: string) {
    // List DM conversations first
    const convRes = await fetch(`${this.API_URL}/conversations.list?types=im&limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const convData = await convRes.json();
    if (!convData.ok) {
      this.logger.warn(`Slack conversations.list failed: ${convData.error}`);
      return [];
    }

    const channels: any[] = convData.channels || [];
    const allMessages: any[] = [];

    for (const channel of channels.slice(0, 3)) {
      const histRes = await fetch(
        `${this.API_URL}/conversations.history?channel=${channel.id}&oldest=${oldest}&limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const histData = await histRes.json();
      if (histData.ok) allMessages.push(...(histData.messages || []));
    }

    return allMessages;
  }

  private async exchangeCode(code: string) {
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('SLACK_CLIENT_ID')!,
        client_secret: this.config.get('SLACK_CLIENT_SECRET')!,
        code,
        redirect_uri: this.redirectUri,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack token exchange failed: ${data.error}`);
    return data;
  }

  async getPresence(integrationId: string): Promise<{ inCall: boolean; status: string; emoji: string }> {
    const integration = await this.prisma.integrationAccount.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new Error('Integration not found');

    const accessToken = integration.accessToken!;

    // Get user profile to check status (huddles set emoji :headphones: + "In a huddle")
    const profileRes = await fetch(`${this.API_URL}/users.profile.get`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = await profileRes.json();

    if (!profileData.ok) {
      this.logger.warn(`Slack profile fetch failed: ${profileData.error}`);
      return { inCall: false, status: '', emoji: '' };
    }

    const statusEmoji: string = profileData.profile?.status_emoji ?? '';
    const statusText: string = profileData.profile?.status_text ?? '';

    // Slack sets these during huddles and calls
    const callEmojis = [':headphones:', ':slack_call:', ':phone:', ':calling:'];
    const callTexts = ['huddle', 'call', 'meeting', 'on a call'];

    const inCall =
      callEmojis.includes(statusEmoji) ||
      callTexts.some((t) => statusText.toLowerCase().includes(t));

    return { inCall, status: statusText, emoji: statusEmoji };
  }

  private async getProfile(accessToken: string) {
    const res = await fetch(`${this.API_URL}/users.identity`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  }
}
