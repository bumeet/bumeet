import { Controller, Get, Patch, Put, Body, Req, UseGuards } from '@nestjs/common';
import { IsInt, Min, Max, IsBoolean, IsString, Matches } from 'class-validator';
import { DeviceService, BatteryStatus, BleDeviceConfig } from './device.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class BatteryDto {
  @IsInt()
  @Min(0)
  @Max(100)
  level: number;
}

class PresenceDto {
  @IsBoolean()
  micActive: boolean;
}

class BleConfigDto {
  @IsString()
  deviceAddress: string;

  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'characteristicUuid must be a valid UUID',
  })
  characteristicUuid: string;
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

  @Patch('presence')
  async updatePresence(@Req() req: any, @Body() dto: PresenceDto) {
    return this.device.updatePresence(req.user.id, dto.micActive);
  }

  @Get('ble-config')
  async getBleConfig(@Req() req: any): Promise<BleDeviceConfig> {
    return this.device.getBleConfig(req.user.id);
  }

  @Put('ble-config')
  async updateBleConfig(@Req() req: any, @Body() dto: BleConfigDto): Promise<BleDeviceConfig> {
    return this.device.updateBleConfig(req.user.id, dto.deviceAddress, dto.characteristicUuid);
  }
}
