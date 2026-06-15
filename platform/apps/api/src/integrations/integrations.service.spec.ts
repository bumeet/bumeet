import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { SlackService } from './slack.service';
import { TeamsService } from './teams.service';
import { ZoomService } from './zoom.service';
import { WebexService } from './webex.service';

/**
 * Regression tests for getLiveStatus() after the "double-check" refactor.
 *
 * Presence model: BUSY requires a REAL signal you are in a meeting — an app
 * reporting an active call, or your mic in use. A bare calendar event only ever
 * yields UPCOMING (it is not proof you joined).
 */

const mockPrisma = {
  integrationAccount: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  calendarEvent: { findFirst: jest.fn() },
};

const presence = () => ({ getPresence: jest.fn() });
const mockSlack = presence();
const mockTeams = presence();
const mockMicrosoft = presence();
const mockZoom = presence();
const mockWebex = presence();

const USER = 'user1';

/** Build an IntegrationAccount-like row for getAll(). */
const account = (provider: string) => ({ id: `${provider}-1`, userId: USER, provider });

describe('IntegrationsService.getLiveStatus', () => {
  let service: IntegrationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GoogleCalendarService, useValue: { getPresence: jest.fn() } },
        { provide: MicrosoftCalendarService, useValue: mockMicrosoft },
        { provide: SlackService, useValue: mockSlack },
        { provide: TeamsService, useValue: mockTeams },
        { provide: ZoomService, useValue: mockZoom },
        { provide: WebexService, useValue: mockWebex },
      ],
    }).compile();

    service = module.get(IntegrationsService);
    jest.clearAllMocks();

    // Defaults: no integrations, no mic, no calendar event.
    mockPrisma.integrationAccount.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ micActive: false, micUpdatedAt: null });
    mockPrisma.calendarEvent.findFirst.mockResolvedValue(null);
  });

  it('returns FREE when a calendar event is active but the user has not joined (no mic/call)', async () => {
    mockPrisma.integrationAccount.findMany.mockResolvedValue([account('google')]);
    // Active event: started in the past, ends in the future → busy:true, upcoming:false.
    mockPrisma.calendarEvent.findFirst.mockResolvedValue({
      title: 'Standup',
      startAt: new Date(Date.now() - 10 * 60_000),
      endAt: new Date(Date.now() + 20 * 60_000),
      allDay: false,
      status: 'confirmed',
      integration: { provider: 'google' },
    });

    const result = await service.getLiveStatus(USER);
    expect(result).toEqual({ busy: false, upcoming: false, payload: 'FREE', source: null, endAt: null });
  });

  it('does NOT mark BUSY from Teams "Busy" availability alone (calendar-derived, not a call)', async () => {
    mockPrisma.integrationAccount.findMany.mockResolvedValue([account('teams')]);
    mockTeams.getPresence.mockResolvedValue({ inCall: false, availability: 'Busy' });

    const result = await service.getLiveStatus(USER);
    expect(result.busy).toBe(false);
    expect(result.payload).toBe('FREE');
  });

  it('marks BUSY when an app reports an active call (Slack inCall)', async () => {
    mockPrisma.integrationAccount.findMany.mockResolvedValue([account('slack')]);
    mockSlack.getPresence.mockResolvedValue({ inCall: true, availability: 'Active' });

    const result = await service.getLiveStatus(USER);
    expect(result).toMatchObject({ busy: true, upcoming: false, payload: 'BUSY · Slack', source: 'Slack' });
  });

  it('marks BUSY when the microphone is in use (fresh agent heartbeat)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ micActive: true, micUpdatedAt: new Date() });

    const result = await service.getLiveStatus(USER);
    expect(result).toMatchObject({ busy: true, upcoming: false, payload: 'BUSY · Call', source: 'Mic' });
  });

  it('ignores a stale mic heartbeat (older than 30 s)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      micActive: true,
      micUpdatedAt: new Date(Date.now() - 60_000),
    });

    const result = await service.getLiveStatus(USER);
    expect(result.busy).toBe(false);
    expect(result.payload).toBe('FREE');
  });

  it('surfaces UPCOMING for a meeting starting within 5 min (heads-up only, not BUSY)', async () => {
    mockPrisma.integrationAccount.findMany.mockResolvedValue([account('google')]);
    mockPrisma.calendarEvent.findFirst.mockResolvedValue({
      title: 'Sync',
      startAt: new Date(Date.now() + 3 * 60_000), // starts in 3 min → upcoming
      endAt: new Date(Date.now() + 33 * 60_000),
      allDay: false,
      status: 'confirmed',
      integration: { provider: 'google' },
    });

    const result = await service.getLiveStatus(USER);
    expect(result.busy).toBe(false);
    expect(result.upcoming).toBe(true);
    expect(result.payload).toContain('UPCOMING · Google Calendar · starts');
  });
});
