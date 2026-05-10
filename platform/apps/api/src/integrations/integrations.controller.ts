import { Controller, Get, Post, Delete, Param, Req, Body, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  @Get()
  getAll(@Req() req: any) {
    return this.integrations.getAll(req.user.id);
  }

  @Get('busy')
  getBusy(@Req() req: any) {
    return this.integrations.getBusyStatus(req.user.id);
  }

  @Get('live-status')
  getLiveStatus(@Req() req: any) {
    return this.integrations.getLiveStatus(req.user.id);
  }

  @Post('connect/:provider')
  connect(@Req() req: any, @Param('provider') provider: string, @Body() body: any) {
    if (provider === 'google') {
      return { redirectUrl: this.integrations.getGoogleAuthUrl(req.user.id) };
    }
    if (provider === 'microsoft') {
      return { redirectUrl: this.integrations.getMicrosoftAuthUrl(req.user.id) };
    }
    if (provider === 'teams') {
      return { redirectUrl: this.integrations.getTeamsAuthUrl(req.user.id) };
    }
    if (provider === 'slack') {
      return { redirectUrl: this.integrations.getSlackAuthUrl(req.user.id) };
    }
    if (provider === 'zoom') {
      return { redirectUrl: this.integrations.getZoomAuthUrl(req.user.id) };
    }
    if (provider === 'webex') {
      return { redirectUrl: this.integrations.getWebexAuthUrl(req.user.id) };
    }
    if (provider === 'apple') {
      const { appleId, appPassword } = body ?? {};
      if (!appleId || !appPassword) {
        return { error: 'appleId and appPassword are required' };
      }
      return this.integrations.connectApple(req.user.id, appleId, appPassword);
    }
    return this.integrations.connectDemo(req.user.id, provider);
  }

  @Delete(':id')
  disconnect(@Req() req: any, @Param('id') id: string) {
    return this.integrations.disconnect(req.user.id, id);
  }

  @Post(':id/sync')
  sync(@Req() req: any, @Param('id') id: string) {
    return this.integrations.triggerSync(req.user.id, id);
  }

  @Get(':id/presence')
  async presence(@Req() req: any, @Param('id') id: string) {
    // Find integration to determine provider
    const integrations = await this.integrations.getAll(req.user.id);
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return null;

    if (integration.provider === 'microsoft') {
      return this.integrations.getMicrosoftPresence(req.user.id, id);
    }
    if (integration.provider === 'teams') {
      return this.integrations.getTeamsPresence(req.user.id, id);
    }
    if (integration.provider === 'slack') {
      return this.integrations.getSlackPresence(req.user.id, id);
    }
    if (integration.provider === 'zoom') {
      return this.integrations.getZoomPresence(req.user.id, id);
    }
    if (integration.provider === 'webex') {
      return this.integrations.getWebexPresence(req.user.id, id);
    }
    return null;
  }
}
