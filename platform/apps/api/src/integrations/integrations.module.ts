import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';

@Module({
  providers: [IntegrationsService, GoogleCalendarService, MicrosoftCalendarService, SlackService, TeamsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, GoogleCalendarService, MicrosoftCalendarService, SlackService, TeamsService],
})
export class IntegrationsModule {}
