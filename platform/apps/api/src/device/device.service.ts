import { Injectable } from '@nestjs/common';

export interface BatteryStatus {
  level: number;      // 0-100
  updatedAt: string;  // ISO timestamp
}

@Injectable()
export class DeviceService {
  private readonly battery = new Map<string, BatteryStatus>();

  updateBattery(userId: string, level: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const status: BatteryStatus = { level: clamped, updatedAt: new Date().toISOString() };
    this.battery.set(userId, status);
    return status;
  }

  getBattery(userId: string): BatteryStatus | null {
    return this.battery.get(userId) ?? null;
  }
}
