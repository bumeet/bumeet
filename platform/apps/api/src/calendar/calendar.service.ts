import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEvents(userId: string, filters: { start?: string; end?: string; providers?: string }) {
    const where: any = { userId };

    if (filters.start || filters.end) {
      where.startAt = {};
      if (filters.start) where.startAt.gte = new Date(filters.start);
      if (filters.end) where.startAt.lte = new Date(filters.end);
    }

    if (filters.providers) {
      const providerList = filters.providers.split(',');
      where.integration = { provider: { in: providerList } };
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: { integration: { select: { provider: true } } },
      orderBy: { startAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startAt: e.startAt,
      endAt: e.endAt,
      allDay: e.allDay,
      location: e.location,
      status: e.status,
      provider: e.integration.provider,
    }));
  }
}
