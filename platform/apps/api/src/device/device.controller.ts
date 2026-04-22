import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { IsInt, Min, Max } from 'class-validator';
import { DeviceService } from './device.service';
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
  updateBattery(@Req() req: any, @Body() dto: BatteryDto) {
    return this.device.updateBattery(req.user.id, dto.level);
  }

  @Get('battery')
  getBattery(@Req() req: any) {
    return this.device.getBattery(req.user.id) ?? { level: null, updatedAt: null };
  }
}
