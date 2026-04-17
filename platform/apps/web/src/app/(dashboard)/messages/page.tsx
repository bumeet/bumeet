'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { Send, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Message = {
  id: string;
  content: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  errorMsg: string | null;
  createdAt: string;
};

const SOURCE_ICONS: Record<string, string> = {
  Slack: '💬',
  'Google Calendar': '📅',
  Microsoft: '📆',
};

function parseMessageMeta(content: string): { label: string; source: string | null; endTime: string | null } {
  if (!content.startsWith('BUSY') && content !== 'FREE') return { label: content, source: null, endTime: null };
  const parts = content.split(' · ');
  const label = parts[0];
  const sourcePart = parts[1] ?? null;
  const endPart = parts.find((p) => p.startsWith('ends ')) ?? null;
  const endTime = endPart ? endPart.replace('ends ', '') : null;
  const source = sourcePart?.replace(/ \+ .+/, '') ?? null;
  return { label, source, endTime };
}

// ── E-ink display simulation ──────────────────────────────────────────────────

function EinkDisplay({ message }: { message: Message | null }) {
  const isBusy = message?.content.startsWith('BUSY');
  const isFree = message?.content === 'FREE' || (!isBusy && message);
  const { source, endTime } = message ? parseMessageMeta(message.content) : { source: null, endTime: null };
  const isCustom = message && !message.content.startsWith('BUSY') && message.content !== 'FREE';

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Live display preview</p>

      {/* Physical device frame */}
      <div
        className="relative rounded-2xl bg-gray-700 p-3 shadow-2xl"
        style={{ width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}
      >
        {/* Screen bezel */}
        <div className="rounded-xl overflow-hidden border border-gray-600" style={{ background: '#1a1a1a' }}>
          {/* E-ink screen area */}
          <div
            className="relative flex flex-col items-center justify-center"
            style={{
              width: '100%',
              height: 160,
              background: message ? (isBusy ? '#f5f0eb' : '#f0f5f0') : '#f2f2f0',
              fontFamily: '"Courier New", Courier, monospace',
              // Subtle eink texture
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.015) 1px, rgba(0,0,0,0.015) 2px)',
            }}
          >
            {!message ? (
              // Empty state
              <div className="text-center px-6">
                <div className="text-3xl mb-2 opacity-20">▭</div>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">No message</p>
              </div>
            ) : isCustom ? (
              // Custom message
              <div className="px-5 w-full">
                <p className="text-gray-900 font-mono text-sm leading-snug break-words text-center">
                  {message.content}
                </p>
              </div>
            ) : isBusy ? (
              // BUSY state
              <div className="flex flex-col items-center gap-1 px-4 w-full">
                <div
                  className="w-full text-center font-mono font-black tracking-widest"
                  style={{ fontSize: 36, color: '#1a1a1a', letterSpacing: '0.15em' }}
                >
                  BUSY
                </div>
                {source && (
                  <p className="text-xs font-mono text-gray-600 tracking-wide">
                    {SOURCE_ICONS[source]} {source}
                  </p>
                )}
                {endTime && (
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    ends {endTime}
                  </p>
                )}
              </div>
            ) : (
              // FREE state
              <div className="flex flex-col items-center gap-1">
                <div
                  className="font-mono font-black tracking-widest"
                  style={{ fontSize: 36, color: '#1a1a1a', letterSpacing: '0.15em' }}
                >
                  FREE
                </div>
                <p className="text-xs font-mono text-gray-500 tracking-wide">available</p>
              </div>
            )}

            {/* Pixel corner decorations for authenticity */}
            <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-gray-300 opacity-40" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-gray-300 opacity-40" />
            <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-gray-300 opacity-40" />
            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-gray-300 opacity-40" />
          </div>
        </div>

        {/* Device bottom bar */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <div className={cn('w-1.5 h-1.5 rounded-full', message ? (isBusy ? 'bg-red-400' : 'bg-green-400') : 'bg-gray-500')} />
          </div>
          <p className="text-gray-500 font-mono" style={{ fontSize: 9 }}>BUMEET · e-ink</p>
          <div className="w-4 h-1 rounded-full bg-gray-600" />
        </div>
      </div>

      {message && (
        <p className="text-xs text-gray-400 mt-2">
          Last updated {format(new Date(message.createdAt), 'HH:mm')}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = ['In a meeting', 'Back at 5pm', 'Do not disturb', 'Working from home', 'BRB', 'On a call'];
const MAX_LEN = 200;

const STATUS_CONFIG: Record<string, { icon: any; label: string; className: string }> = {
  pending: { icon: Loader2, label: 'Pending', className: 'text-yellow-600 bg-yellow-50' },
  sent: { icon: Clock, label: 'Sent', className: 'text-blue-600 bg-blue-50' },
  delivered: { icon: CheckCircle, label: 'Delivered', className: 'text-green-600 bg-green-50' },
  error: { icon: AlertCircle, label: 'Error', className: 'text-red-600 bg-red-50' },
};

export default function MessagesPage() {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = (session as any)?.apiToken;

  // Last delivered message = what the display is currently showing
  // Falls back to a synthetic FREE message so the display never shows "empty"
  const lastDelivered = messages.find((m) => m.status === 'delivered');
  const displayMessage = lastDelivered ?? {
    id: 'default-free',
    content: 'FREE',
    status: 'delivered',
    sentAt: null,
    deliveredAt: null,
    errorMsg: null,
    createdAt: new Date().toISOString(),
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get<Message[]>('/messages', token).then(setMessages).finally(() => setLoading(false));
  }, [token]);

  const handleSend = async () => {
    if (!token || !content.trim()) return;
    setError('');
    setSending(true);
    try {
      const msg = await api.post<Message>('/messages', { content: content.trim() }, token);
      setMessages((prev) => [msg, ...prev]);
      setContent('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);

      const poll = setInterval(async () => {
        const updated = await api.get<Message>(`/messages/${msg.id}`, token);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
        if (updated.status === 'delivered' || updated.status === 'error') clearInterval(poll);
      }, 2500);
      setTimeout(() => clearInterval(poll), 30000);
    } catch (err: any) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const remaining = MAX_LEN - content.length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Display Messages</h1>
        <p className="text-gray-500 mt-1">Send custom messages to your e-ink desk display.</p>
      </div>

      <div className="grid grid-cols-12 gap-6">

        {/* E-ink simulation — 3 cols */}
        <div className="col-span-3 flex flex-col items-center pt-2">
          <EinkDisplay message={content.trim() ? { id: 'preview', content: content.trim(), status: 'delivered', sentAt: null, deliveredAt: null, errorMsg: null, createdAt: new Date().toISOString() } : displayMessage} />
        </div>

        {/* Composer — 5 cols */}
        <div className="col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Compose message</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => setContent(t)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
                rows={4}
                placeholder="Type your message..."
                className={cn(
                  'w-full px-4 py-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors',
                  remaining < 20 ? 'border-red-300' : 'border-gray-300'
                )}
              />
              <span className={cn('absolute bottom-3 right-3 text-xs', remaining < 20 ? 'text-red-500' : 'text-gray-400')}>
                {remaining}
              </span>
            </div>

            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            {sent && <p className="text-sm text-green-600 mt-2 flex items-center gap-1"><CheckCircle size={14} /> Message sent to display!</p>}

            <button
              onClick={handleSend}
              disabled={!content.trim() || sending}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg text-sm transition-colors"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending...' : 'Send to Display'}
            </button>
          </div>
        </div>

        {/* History — 4 cols */}
        <div className="col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-full">
            <h2 className="font-semibold text-gray-900 mb-4">Recent messages</h2>

            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">No messages sent yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {messages.map((msg) => {
                  const status = STATUS_CONFIG[msg.status] || STATUS_CONFIG.pending;
                  const Icon = status.icon;
                  const { label, source, endTime } = parseMessageMeta(msg.content);
                  const isActive = msg.id === displayMessage?.id;
                  return (
                    <div key={msg.id} className={cn('p-3 rounded-lg border transition-colors', isActive ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200')}>
                      {isActive && <p className="text-xs text-brand-600 font-medium mb-1.5">● On display now</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          msg.content.startsWith('BUSY') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        )}>
                          {label}
                        </span>
                        {source && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            {SOURCE_ICONS[source] ?? '🔗'} {source}
                            {endTime && <span className="text-gray-400">· ends {endTime}</span>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={cn('flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded', status.className)}>
                          <Icon size={10} className={msg.status === 'pending' ? 'animate-spin' : ''} />
                          {status.label}
                        </span>
                        <span className="text-xs text-gray-400">{format(new Date(msg.createdAt), 'HH:mm')}</span>
                      </div>
                      {msg.errorMsg && <p className="text-xs text-red-400 mt-1">{msg.errorMsg}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
