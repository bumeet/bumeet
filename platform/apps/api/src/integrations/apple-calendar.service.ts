/**
 * Apple Calendar integration via iCloud CalDAV.
 *
 * No OAuth — uses Apple ID + App-Specific Password (generated at appleid.apple.com).
 * Flow:
 *  1. connect({ userId, appleId, appPassword }) → verifies creds, stores, syncs
 *  2. syncEvents(integrationId) → CalDAV REPORT to fetch events → upsert into DB
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CalEvent {
  uid: string;
  summary: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  status: string;
}

@Injectable()
export class AppleCalendarService {
  private readonly logger = new Logger(AppleCalendarService.name);
  private readonly CALDAV_BASE = 'https://caldav.icloud.com';

  constructor(private prisma: PrismaService) {}

  async connect(userId: string, appleId: string, appPassword: string) {
    const principalUrl = await this.discoverPrincipal(appleId, appPassword);

    const count = await this.prisma.integrationAccount.count({
      where: { userId, provider: 'apple' },
    });
    if (count >= 5) throw new Error('Maximum 5 Apple accounts allowed');

    const integration = await this.prisma.integrationAccount.upsert({
      where: { userId_provider_providerAccountId: { userId, provider: 'apple', providerAccountId: appleId } },
      update: {
        label: appleId,
        accessToken: appPassword,
        refreshToken: principalUrl,
        status: 'active',
        errorMessage: null,
      },
      create: {
        userId,
        provider: 'apple',
        providerAccountId: appleId,
        label: appleId,
        accessToken: appPassword,
        refreshToken: principalUrl,
        status: 'active',
      },
    });

    this.syncEvents(integration.id).catch((err) =>
      this.logger.error('Background Apple Calendar sync failed', err),
    );

    return integration;
  }

  async syncEvents(integrationId: string): Promise<number> {
    const integration = await this.prisma.integrationAccount.findUnique({ where: { id: integrationId } });
    if (!integration) throw new Error('Integration not found');

    const appleId = integration.providerAccountId;
    const appPassword = integration.accessToken!;

    // Use cached principal URL or rediscover
    const principalUrl = integration.refreshToken ?? (await this.discoverPrincipal(appleId, appPassword));
    const calendarHomeUrl = await this.getCalendarHome(appleId, appPassword, principalUrl);
    const calendarUrls = await this.listCalendars(appleId, appPassword, calendarHomeUrl);

    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    let allEvents: CalEvent[] = [];
    for (const calUrl of calendarUrls) {
      const events = await this.fetchCalendarEvents(appleId, appPassword, calUrl, timeMin, timeMax);
      allEvents = allEvents.concat(events);
    }

    let upserted = 0;
    for (const event of allEvents) {
      await this.prisma.calendarEvent.upsert({
        where: { integrationId_externalId: { integrationId, externalId: event.uid } },
        update: {
          title: event.summary,
          startAt: event.startAt,
          endAt: event.endAt,
          allDay: event.allDay,
          status: event.status,
        },
        create: {
          userId: integration.userId,
          integrationId,
          externalId: event.uid,
          title: event.summary,
          startAt: event.startAt,
          endAt: event.endAt,
          allDay: event.allDay,
          status: event.status,
        },
      });
      upserted++;
    }

    const returnedUids = allEvents.map((e) => e.uid);
    if (returnedUids.length > 0) {
      await this.prisma.calendarEvent.deleteMany({
        where: { integrationId, externalId: { notIn: returnedUids } },
      });
    }

    await this.prisma.integrationAccount.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), eventsImported: upserted, status: 'active', errorMessage: null },
    });

    this.logger.log(`Synced ${upserted} Apple Calendar events for integration ${integrationId}`);
    return upserted;
  }

  private authHeader(appleId: string, appPassword: string) {
    return `Basic ${Buffer.from(`${appleId}:${appPassword}`).toString('base64')}`;
  }

  private async discoverPrincipal(appleId: string, appPassword: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;

    const res = await fetch(`${this.CALDAV_BASE}/.well-known/caldav`, {
      method: 'PROPFIND',
      headers: {
        Authorization: this.authHeader(appleId, appPassword),
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
      },
      body,
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`Apple CalDAV discovery failed: ${res.status} — check Apple ID and App-Specific Password`);

    const xml = await res.text();
    const match = xml.match(/<[^>]*:?current-user-principal[^>]*>[\s\S]*?<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/);
    if (!match) throw new Error('Could not determine Apple CalDAV principal URL');

    const href = match[1].trim();
    return href.startsWith('http') ? href : `${this.CALDAV_BASE}${href}`;
  }

  private async getCalendarHome(appleId: string, appPassword: string, principalUrl: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop><cal:calendar-home-set/></d:prop>
</d:propfind>`;

    const res = await fetch(principalUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: this.authHeader(appleId, appPassword),
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
      },
      body,
    });

    if (!res.ok) throw new Error(`Apple CalDAV calendar-home-set fetch failed: ${res.status}`);

    const xml = await res.text();
    const match = xml.match(/<[^>]*:?calendar-home-set[^>]*>[\s\S]*?<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/);
    if (!match) throw new Error('Could not find Apple Calendar home set');

    const href = match[1].trim();
    return href.startsWith('http') ? href : `${this.CALDAV_BASE}${href}`;
  }

  private async listCalendars(appleId: string, appPassword: string, calendarHomeUrl: string): Promise<string[]> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:resourcetype/></d:prop>
</d:propfind>`;

    const res = await fetch(calendarHomeUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: this.authHeader(appleId, appPassword),
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
      body,
    });

    if (!res.ok) throw new Error(`Apple CalDAV list calendars failed: ${res.status}`);

    const xml = await res.text();
    const responseBlocks = [...xml.matchAll(/<[^>]*:?response[^>]*>([\s\S]*?)<\/[^>]*:?response>/g)];
    const calendarUrls: string[] = [];

    for (const [, block] of responseBlocks) {
      // Must contain calendar resourcetype but not inbox/outbox
      if (!block.includes('calendar') || block.includes('schedule-inbox') || block.includes('schedule-outbox')) continue;
      const hrefMatch = block.match(/<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/);
      if (!hrefMatch) continue;

      const href = hrefMatch[1].trim();
      calendarUrls.push(href.startsWith('http') ? href : `${this.CALDAV_BASE}${href}`);
    }

    return calendarUrls;
  }

  private async fetchCalendarEvents(
    appleId: string,
    appPassword: string,
    calendarUrl: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<CalEvent[]> {
    const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${fmt(timeMin)}" end="${fmt(timeMax)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    const res = await fetch(calendarUrl, {
      method: 'REPORT',
      headers: {
        Authorization: this.authHeader(appleId, appPassword),
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
      body,
    });

    if (!res.ok) {
      this.logger.warn(`Apple CalDAV REPORT failed for ${calendarUrl}: ${res.status}`);
      return [];
    }

    return this.parseICalEvents(await res.text());
  }

  private parseICalEvents(xml: string): CalEvent[] {
    const calDataBlocks = [...xml.matchAll(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data>/g)];
    const events: CalEvent[] = [];

    for (const [, ical] of calDataBlocks) {
      const eventBlocks = [...ical.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)];

      for (const [, block] of eventBlocks) {
        const get = (key: string) => {
          const m = block.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'));
          return m ? m[1].trim() : null;
        };

        const uid = get('UID');
        const summary = get('SUMMARY');
        if (!uid || !summary) continue;

        const dtstart = get('DTSTART');
        const dtend = get('DTEND') ?? get('DUE');
        if (!dtstart) continue;

        const allDay = !dtstart.includes('T');
        const startAt = this.parseICalDate(dtstart);
        const endAt = dtend ? this.parseICalDate(dtend) : new Date(startAt.getTime() + 60 * 60 * 1000);
        const rawStatus = get('STATUS') ?? 'CONFIRMED';
        const status = rawStatus === 'CANCELLED' ? 'cancelled' : 'confirmed';

        events.push({ uid, summary, startAt, endAt, allDay, status });
      }
    }

    return events;
  }

  private parseICalDate(dt: string): Date {
    // DATE-TIME: 20240101T120000Z  or  20240101T120000
    // DATE:      20240101
    const s = dt.replace(/[^0-9TZ]/g, '');

    if (s.includes('T')) {
      const yr = parseInt(s.slice(0, 4));
      const mo = parseInt(s.slice(4, 6)) - 1;
      const dy = parseInt(s.slice(6, 8));
      const hr = parseInt(s.slice(9, 11));
      const mn = parseInt(s.slice(11, 13));
      const sc = parseInt(s.slice(13, 15));
      return s.endsWith('Z') ? new Date(Date.UTC(yr, mo, dy, hr, mn, sc)) : new Date(yr, mo, dy, hr, mn, sc);
    }

    return new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
  }
}
