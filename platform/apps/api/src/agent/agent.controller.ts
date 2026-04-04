import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, IsIn } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class PresenceDto {
  @IsString()
  @IsIn(['busy', 'free'])
  status: 'busy' | 'free';
}

class AgentMessageDto {
  @IsString()
  content: string;

  @IsString()
  userId: string;
}

@Controller('agent')
export class AgentController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private checkApiKey(key: string) {
    const expected = this.config.get('AGENT_API_KEY') || 'demo-agent-key-change-in-production';
    if (key !== expected) throw new UnauthorizedException('Invalid agent API key');
  }

  @Post('presence')
  async updatePresence(@Headers('x-agent-key') key: string, @Body() dto: PresenceDto & { userId?: string }) {
    this.checkApiKey(key);
    return { status: dto.status, updatedAt: new Date().toISOString() };
  }

  @Post('message')
  async sendMessage(@Headers('x-agent-key') key: string, @Body() dto: AgentMessageDto) {
    this.checkApiKey(key);
    const user = await this.prisma.user.findFirst();
    if (!user) return { error: 'No users found' };

    return this.prisma.messageToDisplay.create({
      data: { userId: user.id, content: dto.content, status: 'pending' },
    });
  }

  @Get('config')
  async getConfig(@Headers('x-agent-key') key: string) {
    this.checkApiKey(key);
    return {
      payloadBusy: '01',
      payloadFree: '00',
      encoding: 'hex',
      pollInterval: 2,
    };
  }
}
