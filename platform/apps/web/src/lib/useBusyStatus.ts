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
  const queued = useRef<string | null>(null);
  const calendarLoaded = useRef(false);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    busy: false,
    reason: null,
    source: null,
    endAt: null,
  });
  const sendMessage = useCallback(
    async (content: string) => {
      if (!token) return;
      if (sending.current) {
        // Never drop a transition: remember the latest desired state and let the
        // in-flight send flush it. Dropping here left the display stale (e.g. BUSY
        // forever after a call ended during a slow POST).
        queued.current = content;
        return;
      }
      sending.current = true;
      try {
        let next: string | null = content;
        while (next !== null) {
          const current = next;
          try {
            await api.post('/messages', { content: current }, token);
          } catch {
            // best-effort — don't surface errors to user
          }
          next = queued.current;
          queued.current = null;
        }
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
        calendarLoaded.current = true;
        setCalendarStatus(res);
      } catch {
        // ignore
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [token]);

  // Re-evaluate whenever Slack presence OR the calendar status changes. Driving
  // this off the calendarStatus *state* (not a ref) means a calendar-only
  // transition (free→busy with no Slack change) is no longer missed.
  useEffect(() => {
    if (!token) return;
    // Don't send anything until the first /integrations/busy response has landed:
    // before that, calendarStatus is just the initial free placeholder, and the
    // initial send would flip a genuinely-busy display to FREE for up to 30 s.
    if (!calendarLoaded.current) return;

    const slackBusy = Object.values(slackPresence).some((p) => p.inCall);
    const isBusy = slackBusy || calendarStatus.busy;

    if (wasBusy.current === null) {
      // Send initial state so the display always shows something on first load
      wasBusy.current = isBusy;
      sendMessage(isBusy ? buildBusyMessage(slackBusy, calendarStatus) : 'FREE');
      return;
    }

    if (isBusy && !wasBusy.current) {
      wasBusy.current = true;
      sendMessage(buildBusyMessage(slackBusy, calendarStatus));
    } else if (!isBusy && wasBusy.current) {
      wasBusy.current = false;
      sendMessage('FREE');
    }
  }, [slackPresence, calendarStatus, token, sendMessage]);

  return calendarStatus;
}
