import { Controller, Post, Get, Body, Req, Query, UseGuards, Res } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    private googleCalendar: GoogleCalendarService,
    private microsoftCalendar: MicrosoftCalendarService,
    private slack: SlackService,
    private teams: TeamsService,
  ) {}

  @Post('oauth-login')
  oauthLogin(@Body() dto: { provider: string; email: string; name?: string }) {
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
    return this.auth.logout(req.user.id);
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

  @Get('demo-login')
  async demoLogin() {
    return this.auth.login({ email: 'demo@bumeet.io', password: 'Demo1234!' });
  }
}
