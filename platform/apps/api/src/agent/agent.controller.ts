import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { IsString, IsIn } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { DeviceService } from '../device/device.service';

class PresenceDto {
  @IsString()
  @IsIn(['busy', 'free'])
  status: 'busy' | 'free';
}

@Controller('agent')
export class AgentController {
  constructor(
    private prisma: PrismaService,
    private integrations: IntegrationsService,
    private device: DeviceService,
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
    // Actually persist the agent's mic state so live-status can read it back
    // (previously this endpoint was a no-op).
    await this.device.updatePresence(user.id, dto.status === 'busy');
    return { status: dto.status, updatedAt: new Date().toISOString() };
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
    return this.integrations.getLiveStatus(user.id);
  }
}
