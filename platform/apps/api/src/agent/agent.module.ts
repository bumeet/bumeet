import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DeviceModule } from '../device/device.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  controllers: [AgentController],
  imports: [IntegrationsModule, DeviceModule, MessagesModule],
})
export class AgentModule {}
