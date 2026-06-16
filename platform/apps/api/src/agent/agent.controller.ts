import { Controller, Post, Patch, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { DeviceService } from '../device/device.service';
import { MessagesService } from '../messages/messages.service';

class PresenceDto {
  @IsString()
  @IsIn(['busy', 'free'])
  status: 'busy' | 'free';
}

class BatteryDto {
  @IsInt()
  @Min(0)
  @Max(100)
  level: number;
}

@Controller('agent')
export class AgentController {
  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
    private device: DeviceService,
    private messages: MessagesService,
  ) {}

  private async resolveUser(token: string) {
    if (!token) throw new UnauthorizedException('Missing x-agent-key');
    const user = await this.prisma.user.findUnique({ where: { agentToken: token } });
    if (!user) throw new UnauthorizedException('Invalid agent token');
    return user;
  }

  @Post('presence')
  async updatePresence(@Headers('x-agent-key') key: string, @Body() dto: PresenceDto) {
    const user = await this.resolveUser(key);
    await this.device.updatePresence(user.id, dto.status === 'busy');
    return { status: dto.status, updatedAt: new Date().toISOString() };
  }

  @Patch('battery')
  async updateBattery(@Headers('x-agent-key') key: string, @Body() dto: BatteryDto) {
    const user = await this.resolveUser(key);
    return this.device.updateBattery(user.id, dto.level);
  }

  @Get('config')
  async getConfig(@Headers('x-agent-key') key: string) {
    const user = await this.resolveUser(key);
    return {
      payloadBusy: 'BUSY',
      payloadFree: 'FREE',
      encoding: 'text',
      pollInterval: 5,
      ble: {
        deviceAddress: user.bleDeviceAddress ?? null,
        characteristicUuid: user.bleCharacteristicUuid ?? null,
      },
    };
  }

  @Get('live-status')
  async getLiveStatus(@Headers('x-agent-key') key: string) {
    const user = await this.resolveUser(key);
    const [liveStatus, customMsg] = await Promise.all([
      this.integrations.getLiveStatus(user.id),
      this.messages.getLatestPending(user.id),
    ]);
    // A custom message takes over the display — overrides all presence signals.
    if (customMsg) {
      return { ...liveStatus, payload: customMsg.content, customMessageId: customMsg.id };
    }
    return liveStatus;
  }
}
