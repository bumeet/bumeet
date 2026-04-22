'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { Send, CheckCircle, AlertCircle, Clock, Loader2, Zap, Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging, Pin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

const SOURCE_ICONS: Record<string, string> = {
  Slack: '💬',
  'Google Calendar': '📅',
  Microsoft: '📆',
  Mic: '🎙️',
};

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

function CoreInkDevice({ message }: { message: Message | null }) {
  const { label, isBusy, isUpcoming, source, endTime, startTime } = message
    ? parseMessageMeta(message.content)
    : { label: 'FREE', isBusy: false, isUpcoming: false, source: null, endTime: null, startTime: null };

  const isCustom = message && !message.content.startsWith('BUSY') && !message.content.startsWith('UPCOMING') && message.content !== 'FREE';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Device body */}
      <div
        className="relative select-none"
        style={{
          width: 200,
          height: 220,
          background: 'linear-gradient(145deg, #e8e8e6 0%, #d8d8d6 40%, #c8c8c6 100%)',
          borderRadius: 16,
          boxShadow:
            '0 2px 0 #b0b0ae, 0 4px 0 #a0a0a0, 0 6px 0 #909090, 0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
          padding: '14px 14px 10px',
        }}
      >
        {/* Top row: LED + speaker grill */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-0.5 h-1.5 rounded-full bg-gray-500 opacity-50" />
            ))}
          </div>
          {/* Status LED */}
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isBusy ? '#ef4444' : isUpcoming ? '#f59e0b' : '#22c55e',
              boxShadow: isBusy
                ? '0 0 6px #ef4444, 0 0 10px rgba(239,68,68,0.4)'
                : isUpcoming
                ? '0 0 6px #f59e0b, 0 0 10px rgba(245,158,11,0.4)'
                : '0 0 6px #22c55e, 0 0 10px rgba(34,197,94,0.4)',
            }}
          />
        </div>

        {/* E-ink screen bezel */}
        <div
          style={{
            background: '#1a1a1a',
            borderRadius: 6,
            padding: 3,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)',
          }}
        >
          {/* E-ink screen */}
          <div
            style={{
              width: '100%',
              height: 142,
              background: isBusy ? '#f0ece6' : isUpcoming ? '#fef9ec' : '#eef2ee',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Courier New", monospace',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(0,0,0,0.018) 1px,rgba(0,0,0,0.018) 2px)',
            }}
          >
            {isCustom ? (
              <p
                style={{
                  fontSize: 13,
                  color: '#111',
                  textAlign: 'center',
                  padding: '0 10px',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  fontFamily: '"Courier New", monospace',
                }}
              >
                {message!.content}
              </p>
            ) : isBusy ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 900,
                    color: '#111',
                    letterSpacing: '0.12em',
                    lineHeight: 1,
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  BUSY
                </div>
                {source && (
                  <div style={{ fontSize: 10, color: '#444', marginTop: 6, letterSpacing: '0.05em' }}>
                    {SOURCE_ICONS[source]} {source}
                  </div>
                )}
                {endTime && (
                  <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>ends {endTime}</div>
                )}
              </div>
            ) : isUpcoming ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#92400e', letterSpacing: '0.1em', marginBottom: 4 }}>UPCOMING</div>
                {source && (
                  <div style={{ fontSize: 9, color: '#78350f', letterSpacing: '0.05em', marginBottom: 4 }}>
                    {SOURCE_ICONS[source] ?? '📅'} {source}
                  </div>
                )}
                {startTime && (
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>starts {startTime}</div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 900,
                    color: '#111',
                    letterSpacing: '0.12em',
                    lineHeight: 1,
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  FREE
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 6, letterSpacing: '0.08em' }}>
                  available
                </div>
              </div>
            )}

            {/* Pixel corners */}
            {[
              'top-0.5 left-0.5',
              'top-0.5 right-0.5',
              'bottom-0.5 left-0.5',
              'bottom-0.5 right-0.5',
            ].map((pos) => (
              <div key={pos} className={`absolute ${pos} w-1 h-1 bg-gray-400 opacity-30`} />
            ))}
          </div>
        </div>

        {/* Front buttons row */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            className="rounded"
            style={{
              width: 28,
              height: 10,
              background: 'linear-gradient(180deg,#555 0%,#333 100%)',
              boxShadow: '0 2px 0 #222, inset 0 1px 0 rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'default',
            }}
          />
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(145deg,#4a4a4a 0%,#2a2a2a 100%)',
              boxShadow: '0 3px 0 #1a1a1a, inset 0 1px 0 rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#aaa', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>M5</span>
          </div>
          <button
            className="rounded"
            style={{
              width: 28,
              height: 10,
              background: 'linear-gradient(180deg,#555 0%,#333 100%)',
              boxShadow: '0 2px 0 #222, inset 0 1px 0 rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'default',
            }}
          />
        </div>

        {/* USB-C port — right edge */}
        <div
          style={{
            position: 'absolute',
            right: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 20,
            background: '#888',
            borderRadius: '0 3px 3px 0',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.2)',
          }}
        />

        {/* M5Stack label */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 7,
            color: '#999',
            letterSpacing: '0.15em',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          M5STACK COREINK
        </div>
      </div>

      {/* Status pill below device */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full',
            isBusy ? 'bg-red-100 text-red-700' : isUpcoming ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', isBusy ? 'bg-red-500' : isUpcoming ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse')} />
          {isBusy ? 'Busy' : isUpcoming ? 'Upcoming' : 'Free'}
        </span>
        {message && (
          <span className="text-xs text-gray-400">
            updated {format(new Date(message.createdAt), 'HH:mm')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { label: 'In a meeting', icon: '📅' },
  { label: 'On a call', icon: '📞' },
  { label: 'Do not disturb', icon: '🔕' },
  { label: 'Back at 5pm', icon: '⏰' },
  { label: 'Working from home', icon: '🏠' },
  { label: 'BRB', icon: '🔄' },
];

const MAX_LEN = 200;

const STATUS_CONFIG: Record<string, { icon: any; label: string; className: string }> = {
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

  const token = (session as any)?.apiToken;

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

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get<Message[]>('/messages', token).then(setMessages).finally(() => setLoading(false));

    const fetchBattery = () =>
      api.get<{ level: number | null; updatedAt: string | null }>('/device/battery', token)
        .then(setBattery).catch(() => {});
    fetchBattery();
    const battInterval = setInterval(fetchBattery, 60_000);

    const fetchLiveStatus = () =>
      api.get<{ busy: boolean; upcoming: boolean; payload: string; source: string | null; endAt: string | null }>('/integrations/live-status', token)
        .then(setLiveStatus).catch(() => {});
    fetchLiveStatus();
    const statusInterval = setInterval(fetchLiveStatus, 5_000);

    return () => { clearInterval(battInterval); clearInterval(statusInterval); };
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
          const updated = await api.get<Message>(`/messages/${msg.id}`, token);
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
          if (updated.status === 'delivered' || updated.status === 'error') clearInterval(poll);
        }, 2500);
        setTimeout(() => clearInterval(poll), 30000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send');
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">E-ink Display</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Send messages to your M5Stack CoreInk desk display. Status updates automatically from your calendar and Slack.
          </p>
        </div>

        {/* Main grid — responsive: stacked on mobile, side-by-side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── Left: Device preview ── */}
          <div className="col-span-1 md:col-span-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center gap-2 md:sticky md:top-6">
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
            </div>
          </div>

          {/* ── Right: Compose + History ── */}
          <div className="col-span-1 md:col-span-8 flex flex-col gap-6">

            {/* Compose card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-5">Send message</h2>

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2 mb-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setContent(t.label)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-all',
                      content === t.label
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600',
                    )}
                  >
                    <span>{t.icon}</span>
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

              {/* Permanent toggle */}
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none w-fit">
                <div
                  onClick={() => setPermanent((p) => !p)}
                  className={cn(
                    'w-8 h-4 rounded-full transition-colors relative flex-shrink-0',
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

              <button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-sm"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? 'Sending…' : 'Send to Display'}
              </button>
            </div>

            {/* History card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
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
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm">No messages sent yet</p>
                  <p className="text-xs mt-1">Status updates will appear here automatically</p>
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
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                {SOURCE_ICONS[source] ?? '🔗'} {source}
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

                        {/* Right: cancel button for permanent, status + time */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {msg.permanent && !isCancelled && (
                            <button
                              onClick={() => handleCancel(msg.id)}
                              title="Cancel permanent message"
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                              <X size={12} /> Cancel
                            </button>
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
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
