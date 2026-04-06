'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { CheckCircle, Link2, MessageSquare, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type Integration = { id: string; provider: string; status: string; lastSyncAt: string | null; eventsImported: number };
type Message = { id: string; content: string; status: string; createdAt: string };

export default function StatusPage() {
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const token = (session as any)?.apiToken;

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    Promise.all([
      api.get<Integration[]>('/integrations', token),
      api.get<Message[]>('/messages', token),
    ]).then(([integ, msgs]) => {
      setIntegrations(integ);
      setMessages(msgs);
    }).finally(() => setLoading(false));
  }, [token]);

  const connected = integrations.filter((i) => i.status === 'active');
  const totalEvents = integrations.reduce((s, i) => s + i.eventsImported, 0);
  const lastSync = integrations.filter((i) => i.lastSyncAt).sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0];
  const lastMessage = messages[0];

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
        <p className="text-gray-500 mt-1">Overview of your integrations, sync state, and display.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatusCard icon={Link2} iconClass="text-blue-500 bg-blue-50" title="Integrations" value={`${connected.length} / ${integrations.length}`} sub="connected" />
        <StatusCard icon={Activity} iconClass="text-green-500 bg-green-50" title="Events synced" value={totalEvents.toString()} sub="total across all providers" />
        <StatusCard icon={CheckCircle} iconClass="text-brand-500 bg-brand-50" title="Last sync" value={lastSync?.lastSyncAt ? formatDistanceToNow(new Date(lastSync.lastSyncAt), { addSuffix: true }) : '—'} sub={lastSync?.provider || 'no sync yet'} />
        <StatusCard icon={MessageSquare} iconClass="text-purple-500 bg-purple-50" title="Last message" value={lastMessage ? lastMessage.status : '—'} sub={lastMessage ? lastMessage.content.slice(0, 40) : 'no messages sent'} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Integrations detail</h2>
        {integrations.length === 0 ? (
          <p className="text-sm text-gray-500">No integrations connected yet.</p>
        ) : (
          <div className="space-y-3">
            {integrations.map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={cn('w-2 h-2 rounded-full', i.status === 'active' ? 'bg-green-500' : 'bg-red-500')} />
                  <span className="text-sm font-medium text-gray-900 capitalize">{i.provider}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{i.eventsImported} events</p>
                  {i.lastSyncAt && <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(i.lastSyncAt), { addSuffix: true })}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, iconClass, title, value, sub }: { icon: any; iconClass: string; title: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconClass)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 truncate max-w-48">{sub}</p>
      </div>
    </div>
  );
}
