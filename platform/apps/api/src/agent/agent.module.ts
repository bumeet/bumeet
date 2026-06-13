import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  controllers: [AgentController],
  imports: [IntegrationsModule],
})
export class AgentModule {}
