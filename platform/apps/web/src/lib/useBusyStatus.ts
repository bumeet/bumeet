'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from './api';

type SlackPresenceMap = Record<string, { inCall: boolean; presence: string }>;

export type CalendarStatus = {
  busy: boolean;
  reason: string | null;
  source: string | null; // 'google' | 'microsoft' | null
  endAt: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft',
  slack: 'Slack',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildBusyMessage(
  slackBusy: boolean,
  calendar: CalendarStatus,
): string {
  const parts: string[] = ['BUSY'];

  if (slackBusy && calendar.busy) {
    const calLabel = SOURCE_LABEL[calendar.source!] ?? calendar.source;
    parts.push(`Slack + ${calLabel}`);
    if (calendar.endAt) parts.push(`ends ${formatTime(calendar.endAt)}`);
  } else if (slackBusy) {
    parts.push('Slack');
  } else if (calendar.busy) {
    const calLabel = SOURCE_LABEL[calendar.source!] ?? calendar.source;
    parts.push(calLabel);
    if (calendar.endAt) parts.push(`ends ${formatTime(calendar.endAt)}`);
  }

  return parts.join(' · ');
}

/**
 * Monitors busy state across Slack (real-time) and calendar (every 30s).
 * Automatically POSTs a message to /messages when the state transitions:
 *   free → busy : "BUSY"
 *   busy → free : "FREE"
 *
 * Returns calendarStatus so the UI can show an indicator on Google/Microsoft cards.
 */
export function useBusyStatus(
  token: string | undefined,
  slackPresence: SlackPresenceMap,
): CalendarStatus {
  const wasBusy = useRef<boolean | null>(null);
  const sending = useRef(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    busy: false,
    reason: null,
    source: null,
    endAt: null,
  });
  const calendarBusy = useRef(false);
  const latestCalendar = useRef<CalendarStatus>({ busy: false, reason: null, source: null, endAt: null });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!token || sending.current) return;
      sending.current = true;
      try {
        await api.post('/messages', { content }, token);
      } catch {
        // best-effort — don't surface errors to user
      } finally {
        sending.current = false;
      }
    },
    [token],
  );

  // Poll calendar busy status every 30s
  useEffect(() => {
    if (!token) return;

    const check = async () => {
      try {
        const res = await api.get<CalendarStatus>('/integrations/busy', token);
        calendarBusy.current = res.busy;
        latestCalendar.current = res;
        setCalendarStatus(res);
      } catch {
        // ignore
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [token]);

  // Evaluate combined busy state every time slackPresence changes (1s cadence)
  useEffect(() => {
    if (!token) return;

    const slackBusy = Object.values(slackPresence).some((p) => p.inCall);
    const isBusy = slackBusy || calendarBusy.current;

    if (wasBusy.current === null) {
      wasBusy.current = isBusy;
      return;
    }

    if (isBusy && !wasBusy.current) {
      wasBusy.current = true;
      sendMessage(buildBusyMessage(slackBusy, latestCalendar.current));
    } else if (!isBusy && wasBusy.current) {
      wasBusy.current = false;
      sendMessage('FREE');
    }
  }, [slackPresence, token, sendMessage]);

  return calendarStatus;
}
