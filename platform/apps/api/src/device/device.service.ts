import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BatteryStatus {
  level: number;
  updatedAt: string;
}

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async updateBattery(userId: string, level: number): Promise<BatteryStatus> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { batteryLevel: clamped, batteryUpdatedAt: now },
    });
    return { level: clamped, updatedAt: now.toISOString() };
  }

  async getBattery(userId: string): Promise<BatteryStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { batteryLevel: true, batteryUpdatedAt: true },
    });
    if (!user?.batteryLevel || !user.batteryUpdatedAt) return null;
    return { level: user.batteryLevel, updatedAt: user.batteryUpdatedAt.toISOString() };
  }
}
