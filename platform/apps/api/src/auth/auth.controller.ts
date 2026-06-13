import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  UseGuards,
  Res,
  Headers,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from '../integrations/google-calendar.service';
import { MicrosoftCalendarService } from '../integrations/microsoft-calendar.service';
import { SlackService } from '../integrations/slack.service';
import { TeamsService } from '../integrations/teams.service';
import { ZoomService } from '../integrations/zoom.service';
import { WebexService } from '../integrations/webex.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    private googleCalendar: GoogleCalendarService,
    private microsoftCalendar: MicrosoftCalendarService,
    private slack: SlackService,
    private teams: TeamsService,
    private zoom: ZoomService,
    private webex: WebexService,
  ) {}

  // Trusted server-to-server endpoint: the web backend (NextAuth) calls this
  // AFTER it has verified the provider's OAuth, then asserts the verified email.
  // It must NOT be callable by arbitrary clients (that was an account-takeover
  // hole), so it requires a shared internal secret.
  @Post('oauth-login')
  oauthLogin(
    @Headers('x-internal-secret') secret: string,
    @Body() dto: { provider: string; email: string; name?: string },
  ) {
    const expected = this.config.get<string>('INTERNAL_AUTH_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('oauth-login is a trusted server-to-server endpoint');
    }
    return this.auth.oauthLogin(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    // Delete the exact session, not by user id (which deleted nothing).
    return this.auth.logout(req.user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/integrations?error=google_denied`);
    }

    try {
      await this.googleCalendar.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=google`);
    } catch (err) {
      console.error('Google OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=google_failed`);
    }
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/integrations?error=microsoft_denied`);
    }

    try {
      await this.microsoftCalendar.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=microsoft`);
    } catch (err) {
      console.error('Microsoft OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=microsoft_failed`);
    }
  }

  @Get('slack/callback')
  async slackCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/integrations?error=slack_denied`);
    }

    try {
      await this.slack.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=slack`);
    } catch (err) {
      console.error('Slack OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=slack_failed`);
    }
  }

  @Get('teams/callback')
  async teamsCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    if (error || !code) return res.redirect(`${frontendUrl}/integrations?error=teams_denied`);
    try {
      await this.teams.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=teams`);
    } catch (err) {
      console.error('Teams OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=teams_failed`);
    }
  }

  @Get('zoom/callback')
  async zoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    if (error || !code) return res.redirect(`${frontendUrl}/integrations?error=zoom_denied`);
    try {
      await this.zoom.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=zoom`);
    } catch (err) {
      console.error('Zoom OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=zoom_failed`);
    }
  }

  @Get('webex/callback')
  async webexCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    if (error || !code) return res.redirect(`${frontendUrl}/integrations?error=webex_denied`);
    try {
      await this.webex.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/integrations?connected=webex`);
    } catch (err) {
      console.error('Webex OAuth callback error:', err);
      return res.redirect(`${frontendUrl}/integrations?error=webex_failed`);
    }
  }

  // Disabled unless explicitly enabled (never in production). Returns 404 so the
  // route's existence isn't even disclosed.
  @Get('demo-login')
  async demoLogin() {
    if (this.config.get('ENABLE_DEMO_LOGIN') !== 'true') {
      throw new NotFoundException();
    }
    return this.auth.login({ email: 'demo@bumeet.io', password: 'Demo1234!' });
  }
}
