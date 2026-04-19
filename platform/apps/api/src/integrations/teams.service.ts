import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  private readonly AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private readonly TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly GRAPH_URL = 'https://graph.microsoft.com/v1.0';
  private readonly SCOPES = 'openid email profile offline_access User.Read Presence.Read';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get redirectUri() {
    return `${this.config.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/teams/callback`;
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
      where: { userId, provider: 'teams' },
    });
    if (count >= 5) throw new Error('Maximum 5 Teams accounts allowed');

    return this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'teams', providerAccountId: profile.id } },
      update: {
        label: profile.mail ?? profile.userPrincipalName ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'teams',
        providerAccountId: profile.id,
        label: profile.mail ?? profile.userPrincipalName ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: 'active',
      },
    });
  }

  async getPresence(integrationId: string): Promise<{ inCall: boolean; availability: string; activity: string }> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    let accessToken = integration.accessToken!;

    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      const refreshed = await this.refreshToken(integration.refreshToken!);
      accessToken = refreshed.access_token;
      await this.prisma.integrationAccount.update({
        where: { id: integrationId },
        data: { accessToken: refreshed.access_token, tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
      });
    }

    const res = await fetch(`${this.GRAPH_URL}/me/presence`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Graph presence failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    const callActivities = ['InACall', 'InAMeeting', 'InAConferenceCall', 'UrgentInterruptionsOnly'];

    return {
      inCall: callActivities.includes(data.activity),
      availability: data.availability ?? 'Unknown',
      activity: data.activity ?? 'Unknown',
    };
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
    if (!res.ok) throw new Error(`Teams token exchange failed: ${await res.text()}`);
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
    if (!res.ok) throw new Error(`Teams token refresh failed: ${await res.text()}`);
    return res.json();
  }

  private async getProfile(accessToken: string) {
    const res = await fetch(`${this.GRAPH_URL}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Graph profile failed: ${await res.text()}`);
    return res.json();
  }
}
