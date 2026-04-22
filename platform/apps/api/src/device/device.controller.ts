import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { IsInt, Min, Max } from 'class-validator';
import { DeviceService, BatteryStatus } from './device.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class BatteryDto {
  @IsInt()
  @Min(0)
  @Max(100)
  level: number;
}

@UseGuards(JwtAuthGuard)
@Controller('device')
export class DeviceController {
  constructor(private device: DeviceService) {}

  @Patch('battery')
  async updateBattery(@Req() req: any, @Body() dto: BatteryDto): Promise<BatteryStatus> {
    return this.device.updateBattery(req.user.id, dto.level);
  }

  @Get('battery')
  async getBattery(@Req() req: any): Promise<BatteryStatus | { level: null; updatedAt: null }> {
    return (await this.device.getBattery(req.user.id)) ?? { level: null, updatedAt: null };
  }
}
