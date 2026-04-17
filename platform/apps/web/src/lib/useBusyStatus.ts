'use client';

import { useEffect, useRef, useCallback } from 'react';
import { api } from './api';

type SlackPresenceMap = Record<string, { inCall: boolean; presence: string }>;

/**
 * Monitors busy state across Slack (real-time) and calendar (every 30s).
 * Automatically POSTs a message to /messages when the state transitions:
 *   free → busy : "BUSY"
 *   busy → free : "FREE"
 */
export function useBusyStatus(token: string | undefined, slackPresence: SlackPresenceMap) {
  const wasBusy = useRef<boolean | null>(null);
  const sending = useRef(false);

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

  // Check calendar busy status every 30s
  const calendarBusy = useRef(false);
  useEffect(() => {
    if (!token) return;

    const check = async () => {
      try {
        const res = await api.get<{ busy: boolean; reason: string | null; source: string | null }>(
          '/integrations/busy',
          token,
        );
        calendarBusy.current = res.busy;
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

    // Only act on transitions
    if (wasBusy.current === null) {
      wasBusy.current = isBusy;
      return;
    }

    if (isBusy && !wasBusy.current) {
      wasBusy.current = true;
      sendMessage('BUSY');
    } else if (!isBusy && wasBusy.current) {
      wasBusy.current = false;
      sendMessage('FREE');
    }
  }, [slackPresence, token, sendMessage]);
}
