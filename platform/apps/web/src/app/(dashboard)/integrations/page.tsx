'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useBusyStatus } from '@/lib/useBusyStatus';
import { RefreshCw, Unlink, Link2, CheckCircle, AlertCircle, Clock, Plus, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Integration = {
  id: string;
  provider: string;
  status: string;
  lastSyncAt: string | null;
  eventsImported: number;
  errorMessage: string | null;
  label: string | null;
};

type SlackPresence = { inCall: boolean; presence: string; status: string; emoji: string };

const PROVIDERS = [
  { id: 'google', name: 'Google Calendar', description: 'Sync events from Google Calendar', emoji: '📅' },
  { id: 'microsoft', name: 'Microsoft Outlook', description: 'Sync events from Outlook calendar', emoji: '📆' },
  { id: 'slack', name: 'Slack', description: 'Detect calls and huddles in real time', emoji: '💬' },
];

const MAX_ACCOUNTS = 5;

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [slackPresence, setSlackPresence] = useState<Record<string, SlackPresence>>({});

  const token = (session as any)?.apiToken;
  const searchParams = useSearchParams();
  const router = useRouter();

  useBusyStatus(token, slackPresence);

  const [banner, setBanner] = useState<'connected' | 'error' | null>(null);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) { setConnectedProvider(connected); setBanner('connected'); router.replace('/integrations'); }
    if (error) { setBanner('error'); router.replace('/integrations'); }
  }, [searchParams]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get<Integration[]>('/integrations', token).then(setIntegrations).finally(() => setLoading(false));
  }, [token, banner]);

  const pollSlackPresence = useCallback(async (integrationId: string) => {
    if (!token) { setLoading(false); return; }
    try {
      const p = await api.get<SlackPresence>(`/integrations/${integrationId}/presence`, token);
      if (p) setSlackPresence((prev) => ({ ...prev, [integrationId]: p }));
    } catch {}
  }, [token]);

  // Poll Slack presence every 20s for all connected Slack accounts
  useEffect(() => {
    const slackAccounts = integrations.filter((i) => i.provider === 'slack' && i.status === 'active');
    if (!slackAccounts.length) return;

    slackAccounts.forEach((a) => pollSlackPresence(a.id));
    const interval = setInterval(() => slackAccounts.forEach((a) => pollSlackPresence(a.id)), 1_000);
    return () => clearInterval(interval);
  }, [integrations, pollSlackPresence]);

  const getAccounts = (provider: string) => integrations.filter((i) => i.provider === provider);

  const handleConnect = async (provider: string) => {
    if (!token) { setConnectError('Not authenticated. Please sign out and sign in again.'); return; }
    setConnecting(provider);
    setConnectError(null);
    try {
      const result = await api.post<any>(`/integrations/connect/${provider}`, {}, token);
      if (result?.redirectUrl) { window.location.href = result.redirectUrl; return; }
      setIntegrations((prev) => [...prev, result]);
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect. Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    if (!token || !confirm('Disconnect this account? All synced events will be removed.')) return;
    await api.delete(`/integrations/${integration.id}`, token);
    setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
    setSlackPresence((prev) => { const n = { ...prev }; delete n[integration.id]; return n; });
  };

  const handleSync = async (integration: Integration) => {
    if (!token) { setLoading(false); return; }
    setSyncing(integration.id);
    try {
      const updated = await api.post<Integration>(`/integrations/${integration.id}/sync`, {}, token);
      setIntegrations((prev) => prev.map((i) => (i.id === integration.id ? updated : i)));
    } finally {
      setSyncing(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {banner === 'connected' && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <CheckCircle size={16} /> {PROVIDERS.find((p) => p.id === connectedProvider)?.name ?? 'Integration'} connected successfully.
        </div>
      )}
      {banner === 'error' && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={16} /> Connection failed. Please try again.
        </div>
      )}
      {connectError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={16} /> {connectError}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect your calendar providers. Up to {MAX_ACCOUNTS} accounts per provider.</p>
      </div>

      <div className="space-y-6">
        {PROVIDERS.map((provider) => {
          const accounts = getAccounts(provider.id);
          const canAdd = accounts.length < MAX_ACCOUNTS;

          return (
            <div key={provider.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{accounts.length}/{MAX_ACCOUNTS}</span>
                  {canAdd && (
                    <button
                      onClick={() => handleConnect(provider.id)}
                      disabled={connecting === provider.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {accounts.length === 0
                        ? <><Link2 size={12} /> {connecting === provider.id ? 'Connecting...' : 'Connect'}</>
                        : <><Plus size={12} /> {connecting === provider.id ? 'Connecting...' : 'Add account'}</>}
                    </button>
                  )}
                </div>
              </div>

              {accounts.length === 0 ? (
                <div className="px-6 py-5 text-sm text-gray-400 text-center">No accounts connected</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {accounts.map((integration) => {
                    const isError = integration.status === 'error';
                    const slack = provider.id === 'slack' ? slackPresence[integration.id] : null;

                    return (
                      <li key={integration.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">
                                {integration.label ?? integration.id.slice(0, 8)}
                              </span>
                              {isError ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                  <AlertCircle size={10} /> Error
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                  <CheckCircle size={10} /> Active
                                </span>
                              )}
                              {/* Slack live presence + call indicator */}
                              {slack && (
                                <>
                                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                    slack.presence === 'active' ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-100'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${slack.presence === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    {slack.presence === 'active' ? 'Active' : 'Away'}
                                  </span>
                                  {slack.inCall && (
                                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-red-700 bg-red-50 animate-pulse">
                                      <Radio size={10} />
                                      {`In call ${slack.emoji}`}
                                    </span>
                                  )}
                                  {!slack.inCall && slack.status && (
                                    <span className="text-xs text-gray-400">{slack.status}</span>
                                  )}
                                </>
                              )}
                            </div>
                            {integration.lastSyncAt && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock size={10} />
                                Last sync {formatDistanceToNow(new Date(integration.lastSyncAt), { addSuffix: true })} · {integration.eventsImported} events
                              </p>
                            )}
                            {integration.errorMessage && (
                              <p className="text-xs text-red-500 mt-0.5">{integration.errorMessage}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSync(integration)}
                              disabled={syncing === integration.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw size={12} className={syncing === integration.id ? 'animate-spin' : ''} />
                              Sync
                            </button>
                            <button
                              onClick={() => handleDisconnect(integration)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Unlink size={12} />
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
