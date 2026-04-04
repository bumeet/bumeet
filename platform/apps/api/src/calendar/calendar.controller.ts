import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private calendar: CalendarService) {}

  @Get('events')
  getEvents(@Req() req: any, @Query() query: { start?: string; end?: string; providers?: string }) {
    return this.calendar.getEvents(req.user.id, query);
  }
}
