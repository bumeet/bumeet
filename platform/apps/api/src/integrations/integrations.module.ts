import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';

@Module({
  providers: [IntegrationsService, GoogleCalendarService, MicrosoftCalendarService, SlackService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, GoogleCalendarService, MicrosoftCalendarService, SlackService],
})
export class IntegrationsModule {}
