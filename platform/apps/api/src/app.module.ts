import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { CalendarModule } from './calendar/calendar.module';
import { MessagesModule } from './messages/messages.module';
import { AgentModule } from './agent/agent.module';
import { DeviceModule } from './device/device.module';
import { PairingModule } from './pairing/pairing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    IntegrationsModule,
    CalendarModule,
    MessagesModule,
    AgentModule,
    DeviceModule,
    PairingModule,
  ],
  providers: [
    // Enforce the rate limiter globally (it was configured but never applied).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
