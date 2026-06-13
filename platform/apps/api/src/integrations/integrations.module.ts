import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { ZoomService } from './zoom.service';
import { WebexService } from './webex.service';
import { OAuthStateService } from './oauth-state.service';

@Module({
  providers: [
    IntegrationsService,
    GoogleCalendarService,
    MicrosoftCalendarService,
    SlackService,
    TeamsService,
    ZoomService,
    WebexService,
    OAuthStateService,
  ],
  controllers: [IntegrationsController],
  exports: [
    IntegrationsService,
    GoogleCalendarService,
    MicrosoftCalendarService,
    SlackService,
    TeamsService,
    ZoomService,
    WebexService,
  ],
})
export class IntegrationsModule {}
