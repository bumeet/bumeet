import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';

@Module({
  controllers: [AgentController],
  imports: [],
})
export class AgentModule {}
