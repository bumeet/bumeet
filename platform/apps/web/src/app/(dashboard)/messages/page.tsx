'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { Send, CheckCircle, AlertCircle, Clock, Loader2, Zap, BatteryLow, BatteryMedium, BatteryFull, Pin, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  content: string;
  status: string;
  permanent: boolean;
  sentAt: string | null;
  deliveredAt: string | null;
  errorMsg: string | null;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMessageMeta(content: string) {
  if (!content.startsWith('BUSY') && !content.startsWith('UPCOMING') && content !== 'FREE')
    return { label: content, isBusy: false, isFree: false, isUpcoming: false, source: null, endTime: null, startTime: null };
  const parts = content.split(' · ');
  const label = parts[0];
  const sourcePart = parts[1] ?? null;
  const endPart = parts.find((p) => p.startsWith('ends ')) ?? null;
  const startPart = parts.find((p) => p.startsWith('starts ')) ?? null;
  const endTime = endPart ? endPart.replace('ends ', '') : null;
  const startTime = startPart ? startPart.replace('starts ', '') : null;
  const source = sourcePart?.replace(/ \+ .+/, '').replace('starts', '').replace('ends', '').trim() ?? null;
  return {
    label,
    isBusy: label === 'BUSY',
    isFree: label === 'FREE',
    isUpcoming: label === 'UPCOMING',
    source: source || null,
    endTime,
    startTime,
  };
}

// ─── Battery indicator ────────────────────────────────────────────────────────

function BatteryIndicator({ level, updatedAt }: { level: number | null; updatedAt: string | null }) {
  if (level === null) return null;

  const Icon = level <= 15 ? BatteryLow : level <= 40 ? BatteryMedium : BatteryFull;
  const color = level <= 15 ? 'text-red-500' : level <= 40 ? 'text-yellow-500' : 'text-green-500';
  const bgColor = level <= 15 ? 'bg-red-50 border-red-100' : level <= 40 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100';

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs', bgColor)}>
      <Icon size={13} className={color} />
      <span className={cn('font-semibold tabular-nums', color)}>{level}%</span>
      {updatedAt && (
        <span className="text-gray-400 hidden sm:inline">
          · {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ─── M5Stack CoreInk device illustration ──────────────────────────────────────
// Matches the physical device: dark matte body, square 200×200 e-ink panel,
// 3 front buttons (A · PWR · B), USB-C on left side.

const DISP = 144; // e-ink active area (square, matches 200×200 physical panel)

function EinkScreen({ label, isBusy, isUpcoming, source, endTime, startTime, isCustom, content }: {
  label: string; isBusy: boolean; isUpcoming: boolean;
  source: string | null; endTime: string | null; startTime: string | null;
  isCustom: boolean; content: string;
}) {
  const bg = isBusy ? '#0d0d0d' : '#ece9e2';
  const scanlines = isBusy ? undefined :
    'repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(0,0,0,0.025) 1px,rgba(0,0,0,0.025) 2px)';

  return (
    <div style={{
      width: DISP, height: DISP,
      background: bg,
      backgroundImage: scanlines,
      borderRadius: 2,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '"Courier New", Courier, monospace',
    }}>
      {isCustom ? (
        // Custom text message — wrap and center
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 10px',
        }}>
          <p style={{ fontSize: 12, color: '#111', textAlign: 'center', lineHeight: 1.45, wordBreak: 'break-word' }}>
            {content}
          </p>
        </div>
      ) : isBusy ? (
        // BUSY: black bg, "BUSY" centred, source + end time below
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: source ? Math.round(DISP * 0.25) : 0,
          justifyContent: source ? undefined : 'center',
        }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#ece9e2', letterSpacing: '0.06em', lineHeight: 1 }}>
            BUSY
          </div>
          {source && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 9, letterSpacing: '0.05em' }}>
              {source}
            </div>
          )}
          {endTime && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>ends {endTime}</div>
          )}
        </div>
      ) : isUpcoming ? (
        // UPCOMING: white bg, black centre band ("SOON"), source + start time below
        <>
          <div style={{
            position: 'absolute',
            top: Math.round(DISP * 0.30), left: 0, right: 0,
            height: Math.round(DISP * 0.28),
            background: '#0d0d0d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#ece9e2', letterSpacing: '0.06em' }}>
              SOON
            </span>
          </div>
          {source && (
            <div style={{
              position: 'absolute', top: Math.round(DISP * 0.66),
              left: 0, right: 0, textAlign: 'center',
              fontSize: 10, color: '#555', letterSpacing: '0.04em',
            }}>
              {source}
            </div>
          )}
          {startTime && (
            <div style={{
              position: 'absolute', top: Math.round(DISP * 0.79),
              left: 0, right: 0, textAlign: 'center',
              fontSize: 13, fontWeight: 700, color: '#222',
            }}>
              starts {startTime}
            </div>
          )}
        </>
      ) : (
        // FREE: off-white, "FREE" centred
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingBottom: 6,
        }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#111', letterSpacing: '0.06em', lineHeight: 1 }}>
            FREE
          </div>
          <div style={{ fontSize: 9, color: '#999', marginTop: 8, letterSpacing: '0.14em' }}>
            AVAILABLE
          </div>
        </div>
      )}
    </div>
  );
}

function CoreInkDevice({ message }: { message: Message | null }) {
  const { label, isBusy, isUpcoming, source, endTime, startTime } = message
    ? parseMessageMeta(message.content)
    : { label: 'FREE', isBusy: false, isUpcoming: false, source: null, endTime: null, startTime: null };

  const isCustom = message
    ? !['FREE', 'BUSY', 'UPCOMING'].includes(label)
    : false;

  // Device body: 180 × 200 px — slightly portrait to fit buttons below display
  const W = 180;
  const sidePad = 15;  // horizontal margin inside body → display container = 180 - 30 = 150
  const bezelPad = 3;  // border around e-ink panel
  // DISP (144) + 2*bezelPad (6) = 150 — fills exactly

  return (
    <div className="flex flex-col items-center gap-3">
      {/* ── Device chassis ── */}
      <div className="relative select-none" style={{
        width: W,
        height: 200,
        background: '#181818',
        borderRadius: 10,
        boxShadow: [
          '0 12px 40px rgba(0,0,0,0.65)',
          '0 4px 12px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.05)',
        ].join(', '),
      }}>

        {/* ── E-ink panel + bezel ── */}
        <div style={{
          position: 'absolute',
          top: 14, left: sidePad, right: sidePad,
        }}>
          {/* Bezel */}
          <div style={{
            padding: bezelPad,
            background: '#0d0d0d',
            borderRadius: 4,
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            <EinkScreen
              label={label} isBusy={isBusy} isUpcoming={isUpcoming}
              source={source} endTime={endTime} startTime={startTime}
              isCustom={isCustom} content={message?.content ?? 'FREE'}
            />
          </div>
        </div>

        {/* ── Three front buttons (A · PWR · B) ── */}
        <div style={{
          position: 'absolute',
          bottom: 16, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          padding: '0 20px',
        }}>
          {/* Button A */}
          <div style={{
            width: 30, height: 7, borderRadius: 3,
            background: '#2a2a2a',
            boxShadow: '0 2px 0 #0a0a0a, inset 0 1px 0 rgba(255,255,255,0.06)',
          }} />
          {/* Centre power / M5 button */}
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #333 0%, #1a1a1a 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 5.5, color: '#555', fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: 0.3 }}>M5</span>
          </div>
          {/* Button B */}
          <div style={{
            width: 30, height: 7, borderRadius: 3,
            background: '#2a2a2a',
            boxShadow: '0 2px 0 #0a0a0a, inset 0 1px 0 rgba(255,255,255,0.06)',
          }} />
        </div>

        {/* ── USB-C — left side ── */}
        <div style={{
          position: 'absolute',
          left: -3, bottom: 32,
          width: 4, height: 12,
          background: '#2e2e2e',
          borderRadius: '2px 0 0 2px',
          boxShadow: 'inset 1px 0 2px rgba(0,0,0,0.5)',
        }} />

        {/* ── Status LED — top-right corner ── */}
        <div style={{
          position: 'absolute', top: 8, right: 12,
          width: 5, height: 5, borderRadius: '50%',
          background: isBusy ? '#ef4444' : isUpcoming ? '#f59e0b' : '#22c55e',
          boxShadow: isBusy
            ? '0 0 5px 1px rgba(239,68,68,0.5)'
            : isUpcoming
            ? '0 0 5px 1px rgba(245,158,11,0.5)'
            : '0 0 5px 1px rgba(34,197,94,0.5)',
        }} />

        {/* ── M5Stack label ── */}
        <div style={{
          position: 'absolute', bottom: 5, left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 6, color: '#3a3a3a', letterSpacing: '0.18em',
          fontFamily: 'sans-serif', whiteSpace: 'nowrap', userSelect: 'none',
        }}>
          M5STACK COREINK
        </div>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full',
          isBusy ? 'bg-red-100 text-red-700' : isUpcoming ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full',
            isBusy ? 'bg-red-500' : isUpcoming ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse',
          )} />
          {isBusy ? 'Busy' : isUpcoming ? 'Upcoming' : 'Free'}
        </span>
        {message && (
          <span className="text-xs text-gray-400">updated {format(new Date(message.createdAt), 'HH:mm')}</span>
        )}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { label: 'En reunión' },
  { label: 'No molestar' },
  { label: 'Ahora vuelvo' },
  { label: 'Trabajo en remoto' },
  { label: 'In a meeting' },
  { label: 'Do not disturb' },
  { label: 'Be right back' },
  { label: 'Working remotely' },
];

const MAX_LEN = 64;

const STATUS_CONFIG: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  pending:   { icon: Loader2,      label: 'Sending…',   className: 'text-yellow-600 bg-yellow-50' },
  sent:      { icon: Clock,        label: 'Sent',        className: 'text-blue-600 bg-blue-50' },
  delivered: { icon: CheckCircle,  label: 'Delivered',   className: 'text-green-600 bg-green-50' },
  cancelled: { icon: X,            label: 'Cancelled',   className: 'text-gray-400 bg-gray-50' },
  error:     { icon: AlertCircle,  label: 'Error',       className: 'text-red-600 bg-red-50' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [permanent, setPermanent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [battery, setBattery] = useState<{ level: number | null; updatedAt: string | null }>({ level: null, updatedAt: null });
  const [liveStatus, setLiveStatus] = useState<{ busy: boolean; upcoming: boolean; payload: string; source: string | null; endAt: string | null } | null>(null);

  const token = session?.apiToken;

  // Device preview: typed content > live status > last delivered message > FREE
  const liveMessage: Message | null = liveStatus
    ? { id: 'live', content: liveStatus.payload, status: 'delivered', permanent: false, sentAt: null, deliveredAt: null, errorMsg: null, createdAt: new Date().toISOString() }
    : null;
  const lastDelivered = messages.find((m) => m.status === 'delivered');
  const displayMessage: Message = liveMessage ?? lastDelivered ?? {
    id: 'default-free',
    content: 'FREE',
    status: 'delivered',
    permanent: false,
    sentAt: null,
    deliveredAt: null,
    errorMsg: null,
    createdAt: new Date().toISOString(),
  };
  const previewMessage: Message = content.trim()
    ? { ...displayMessage, id: 'preview', content: content.trim() }
    : displayMessage;

  // Track per-send delivery polls so they can be cleared on unmount (otherwise
  // they keep calling setMessages on an unmounted component and leak timers).
  const sendPolls = useRef<
    { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }[]
  >([]);
  useEffect(
    () => () => {
      sendPolls.current.forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
      sendPolls.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get<Message[]>('/messages', token).then(setMessages).finally(() => setLoading(false));

    // Skip polling while the tab is hidden, and refetch on return — an idle
    // background dashboard shouldn't hit the API every 5 s.
    const fetchBattery = () => {
      if (document.visibilityState !== 'visible') return;
      api.get<{ level: number | null; updatedAt: string | null }>('/device/battery', token)
        .then(setBattery).catch(() => {});
    };
    const fetchLiveStatus = () => {
      if (document.visibilityState !== 'visible') return;
      api.get<{ busy: boolean; upcoming: boolean; payload: string; source: string | null; endAt: string | null }>('/integrations/live-status', token)
        .then(setLiveStatus).catch(() => {});
    };
    fetchBattery();
    fetchLiveStatus();
    const battInterval = setInterval(fetchBattery, 60_000);
    const statusInterval = setInterval(fetchLiveStatus, 5_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') { fetchBattery(); fetchLiveStatus(); }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(battInterval);
      clearInterval(statusInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  const handleSend = async () => {
    if (!token || !content.trim()) return;
    setError('');
    setSending(true);
    try {
      const msg = await api.post<Message>('/messages', { content: content.trim(), permanent }, token);
      setMessages((prev) => [msg, ...prev]);
      setContent('');
      setPermanent(false);
      setSent(true);
      setTimeout(() => setSent(false), 3000);

      if (!permanent) {
        const poll = setInterval(async () => {
          try {
            const updated = await api.get<Message>(`/messages/${msg.id}`, token);
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
            if (updated.status === 'delivered' || updated.status === 'error') clearInterval(poll);
          } catch {
            /* ignore transient poll errors */
          }
        }, 2500);
        const timeout = setTimeout(() => clearInterval(poll), 30000);
        sendPolls.current.push({ interval: poll, timeout });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!token) return;
    try {
      const updated = await api.patch<Message>(`/messages/${id}/cancel`, {}, token);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch { /* ignore */ }
  };

  const remaining = MAX_LEN - content.length;

  return (
    <div className="min-h-full bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-gray-900">E-ink Display</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Send messages to your M5Stack CoreInk desk display. Status updates automatically from your calendar and Slack.
          </p>
        </div>

        {/* Main grid — responsive: stacked on mobile, side-by-side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── Left: Device preview ── */}
          <div className="col-span-1 md:col-span-4">
            <Card className="rounded-2xl p-6 flex flex-col items-center gap-2 md:sticky md:top-6">
              <div className="flex items-center justify-between mb-4 w-full">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live preview</span>
                </div>
                <BatteryIndicator level={battery.level} updatedAt={battery.updatedAt} />
              </div>
              <CoreInkDevice message={previewMessage} />
              {content.trim() ? (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Preview — not yet sent to device
                </p>
              ) : liveStatus && (
                <div className={cn(
                  'mt-2 flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium',
                  liveStatus.busy
                    ? 'bg-red-50 text-red-600'
                    : liveStatus.upcoming
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-green-50 text-green-600',
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full animate-pulse',
                    liveStatus.busy ? 'bg-red-500' : liveStatus.upcoming ? 'bg-amber-500' : 'bg-green-500',
                  )} />
                  {liveStatus.busy
                    ? `Busy · ${liveStatus.source ?? ''}`
                    : liveStatus.upcoming
                    ? 'Upcoming meeting'
                    : 'Free'}
                  <span className="text-gray-400 ml-1">· live</span>
                </div>
              )}
            </Card>
          </div>

          {/* ── Right: Compose + History ── */}
          <div className="col-span-1 md:col-span-8 flex flex-col gap-6">

            {/* Compose card */}
            <Card className="rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-5">Send message</h2>

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2 mb-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setContent(t.label)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-all',
                      content === t.label
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
                  rows={3}
                  placeholder="Or type a custom message…"
                  className={cn(
                    'w-full px-4 py-3 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all',
                    remaining < 20 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50',
                  )}
                />
                <span
                  className={cn(
                    'absolute bottom-3 right-3 text-xs tabular-nums',
                    remaining < 20 ? 'text-red-500' : 'text-gray-400',
                  )}
                >
                  {remaining}
                </span>
              </div>

              {/* Permanent toggle — real checkbox (sr-only) so it's keyboard
                  focusable and Space-togglable; the div is just the visual track. */}
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={permanent}
                  onChange={(e) => setPermanent(e.target.checked)}
                  className="sr-only peer"
                />
                <div
                  className={cn(
                    'w-8 h-4 rounded-full transition-colors relative flex-shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1',
                    permanent ? 'bg-brand-500' : 'bg-gray-200',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all',
                      permanent ? 'left-4' : 'left-0.5',
                    )}
                  />
                </div>
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Pin size={11} className={permanent ? 'text-brand-500' : 'text-gray-400'} />
                  Keep on display permanently
                </span>
              </label>
              {permanent && (
                <p className="text-xs text-amber-600 mt-1.5 ml-10">
                  This message will stay on the display until you cancel it, even when meetings start or end.
                </p>
              )}

              {/* Feedback */}
              {error && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              {sent && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <CheckCircle size={14} /> Sent to display!
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                size="lg"
                className="mt-4 w-full"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? 'Sending…' : 'Send to Display'}
              </Button>
            </Card>

            {/* History card */}
            <Card className="rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-900">Message history</h2>
                <span className="text-xs text-gray-400">{messages.length} messages</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-sm">No hay mensajes enviados</p>
                  <p className="text-xs mt-1">Los cambios de estado aparecerán aquí automáticamente</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto -mr-2 pr-2">
                  {messages.map((msg) => {
                    const statusCfg = STATUS_CONFIG[msg.status] || STATUS_CONFIG.pending;
                    const Icon = statusCfg.icon;
                    const { label, isBusy, isFree, isUpcoming, source, endTime, startTime } = parseMessageMeta(msg.content);
                    const isOnDisplay = msg.id === lastDelivered?.id;
                    const isAuto = isBusy || isFree || isUpcoming;
                    const isCancelled = msg.status === 'cancelled';

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                          isCancelled
                            ? 'border-gray-100 bg-gray-50 opacity-50'
                            : msg.permanent
                            ? 'border-brand-200 bg-brand-50'
                            : isOnDisplay
                            ? 'border-brand-200 bg-brand-50'
                            : 'border-gray-100 hover:border-gray-200 bg-white',
                        )}
                      >
                        {/* Status dot */}
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            isBusy ? 'bg-red-500' : isFree ? 'bg-green-500' : isUpcoming ? 'bg-amber-400' : 'bg-gray-400',
                          )}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'text-sm font-semibold',
                              isBusy ? 'text-red-700' : isFree ? 'text-green-700' : isUpcoming ? 'text-amber-700' : 'text-gray-900',
                            )}>
                              {label}
                            </span>
                            {source && (
                              <span className="text-xs text-gray-500">
                                {source}
                              </span>
                            )}
                            {endTime && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} /> ends {endTime}
                              </span>
                            )}
                            {startTime && (
                              <span className="text-xs text-amber-500 flex items-center gap-1">
                                <Clock size={10} /> starts {startTime}
                              </span>
                            )}
                            {isAuto && (
                              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                <Zap size={9} /> auto
                              </span>
                            )}
                            {msg.permanent && !isCancelled && (
                              <span className="flex items-center gap-0.5 text-xs text-brand-600">
                                <Pin size={9} /> pinned
                              </span>
                            )}
                          </div>
                          {isOnDisplay && !isCancelled && (
                            <p className="text-xs text-brand-600 font-medium mt-0.5">On display now</p>
                          )}
                        </div>

                        {/* Right: cancel button for any active custom message, status + time */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {!isAuto && !isCancelled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(msg.id)}
                              title="Quitar mensaje del display"
                              className="gap-1 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <X size={12} /> Quitar
                            </Button>
                          )}
                          <div className="text-right">
                            <span className={cn(
                              'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                              statusCfg.className,
                            )}>
                              <Icon size={9} className={msg.status === 'pending' ? 'animate-spin' : ''} />
                              {statusCfg.label}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">{format(new Date(msg.createdAt), 'HH:mm')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
