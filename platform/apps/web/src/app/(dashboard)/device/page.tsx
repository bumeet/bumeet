'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Bluetooth, Terminal, CheckCircle, AlertCircle,
  Loader2, Download, Copy, Check, Monitor, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_CHAR_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567892';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type Platform = 'macos' | 'windows';

interface BleConfig {
  deviceAddress: string | null;
  characteristicUuid: string | null;
}

function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="bg-gray-900 rounded-lg p-4 flex items-start gap-3">
      <Terminal size={16} className="text-gray-400 mt-0.5 shrink-0" />
      <code className="text-green-400 text-sm break-all flex-1">{value}</code>
      <button onClick={copy} className="shrink-0 text-gray-400 hover:text-white transition-colors">
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

function Troubleshoot({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-500 transition-colors"
      >
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
        {label}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

function DevicePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [platform, setPlatform] = useState<Platform>('macos');
  const [config, setConfig] = useState<BleConfig>({ deviceAddress: null, characteristicUuid: null });
  const [address, setAddress] = useState('');
  const [uuid, setUuid] = useState(DEFAULT_CHAR_UUID);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pairCode, setPairCode] = useState('');
  const [pairStatus, setPairStatus] = useState<'idle' | 'linking' | 'done' | 'error'>('idle');

  const token = session?.apiToken;

  const macCmd = token
    ? `curl -fsSL https://app.bumeet.es/downloads/install-macos.sh | bash -s -- --token ${token}`
    : `curl -fsSL https://app.bumeet.es/downloads/install-macos.sh | bash`;

  const winCmdFull = token
    ? `& ([scriptblock]::Create((irm https://app.bumeet.es/downloads/install-windows.ps1))) -Token "${token}"`
    : `& ([scriptblock]::Create((irm https://app.bumeet.es/downloads/install-windows.ps1)))`;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/device/ble-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: BleConfig = await res.json();
        setConfig(data);
        if (data.deviceAddress) setAddress(data.deviceAddress);
        if (data.characteristicUuid) setUuid(data.characteristicUuid);
      }
    } catch {}
  }, [token]);

  // Auto-approve when agent opens the portal with ?pair=CODE
  useEffect(() => {
    const code = searchParams.get('pair');
    if (!code || !token || pairStatus !== 'idle') return;
    setPairCode(code);
    setPairStatus('linking');
    fetch(`${API_URL}/agent/pair/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase() }),
    })
      .then(r => setPairStatus(r.ok ? 'done' : 'error'))
      .catch(() => setPairStatus('error'));
  }, [searchParams, token, pairStatus]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!token || !address.trim() || !uuid.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`${API_URL}/device/ble-config`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceAddress: address.trim(), characteristicUuid: uuid.trim() }),
      });
      if (res.ok) {
        const data: BleConfig = await res.json();
        setConfig(data);
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  async function linkAgent() {
    if (!token || pairCode.trim().length !== 6) return;
    setPairStatus('linking');
    try {
      const res = await fetch(`${API_URL}/agent/pair/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode.trim().toUpperCase() }),
      });
      setPairStatus(res.ok ? 'done' : 'error');
    } catch {
      setPairStatus('error');
    }
  }

  const isPaired = Boolean(config.deviceAddress && config.characteristicUuid);
  const hasPairParam = Boolean(searchParams.get('pair'));

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bluetooth size={24} className="text-brand-500" />
          Device Setup
        </h1>
        <p className="text-gray-500 mt-1">
          Connect your BUMEET e-ink display via Bluetooth.
        </p>
      </div>

      {/* Step 1 — Install agent */}
      <section className="mb-8">
        <StepHeader n={1} done={false} title="Install the desktop agent" />

        <div className="ml-8 mb-3 flex gap-2">
          {(['macos', 'windows'] as Platform[]).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                platform === p ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Monitor size={14} />
              {p === 'macos' ? 'macOS' : 'Windows'}
            </button>
          ))}
        </div>

        {platform === 'macos' && (
          <div className="ml-8 space-y-3">
            <a
              href="https://stbumeetreleases.blob.core.windows.net/releases/latest/bumeet-agent.dmg"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Download size={16} />
              Download for macOS
            </a>
            <p className="text-sm text-gray-500">
              Open the <strong>.dmg</strong> and double-click <strong>Install BUMEET Agent</strong>.
              The agent installs itself and appears in your menu bar. Requires macOS 13+.
            </p>
            <Troubleshoot label="Advanced — install from Terminal">
              <CopyBlock value={macCmd} />
            </Troubleshoot>
          </div>
        )}

        {platform === 'windows' && (
          <div className="ml-8 space-y-3">
            <a
              href="https://stbumeetreleases.blob.core.windows.net/releases/latest/bumeet-agent-windows.exe"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Download size={16} />
              Download for Windows
            </a>
            <p className="text-sm text-gray-500">
              Double-click the downloaded <strong>.exe</strong> — it installs itself and starts automatically.
              Requires Windows 10/11. No admin required.
            </p>
            <Troubleshoot label="Advanced — install from PowerShell">
              <CopyBlock value={winCmdFull} />
            </Troubleshoot>
          </div>
        )}
      </section>

      {/* Step 2 — Link agent */}
      <section className="mb-8">
        <StepHeader n={2} done={pairStatus === 'done'} title="Link the agent to your account" />
        <div className="ml-8">
          {pairStatus === 'linking' && (
            <p className="text-sm text-brand-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Linking…
            </p>
          )}
          {pairStatus === 'done' && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} /> Agent linked successfully
            </p>
          )}
          {pairStatus === 'error' && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={14} /> Code not found or expired — restart the agent and try again
            </p>
          )}
          {pairStatus === 'idle' && !hasPairParam && (
            <p className="text-sm text-gray-500">
              Once the agent starts it will open this page and link itself automatically.
            </p>
          )}

          {/* Manual fallback — only show when auto didn't trigger */}
          {(pairStatus === 'idle' || pairStatus === 'error') && !hasPairParam && (
            <Troubleshoot label="The agent didn't open a browser window?">
              <p className="text-xs text-gray-500">Enter the 6-character code shown in the agent&apos;s menu or terminal:</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  maxLength={6}
                  value={pairCode}
                  onChange={e => { setPairCode(e.target.value.toUpperCase()); setPairStatus('idle'); }}
                  placeholder="A3K7P2"
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={linkAgent}
                  disabled={pairCode.trim().length !== 6}
                  className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Link
                </button>
              </div>
            </Troubleshoot>
          )}
        </div>
      </section>

      {/* Step 3 — BLE display */}
      <section className="mb-8">
        <StepHeader n={3} done={isPaired} title="Connect to your e-ink display" />
        <div className="ml-8">
          {isPaired ? (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />
              Display found:{' '}
              <code className="font-mono text-xs bg-green-50 px-1 rounded ml-1">{config.deviceAddress}</code>
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              The agent scans for your display automatically once it&apos;s running.
              Make sure the display is powered on and nearby.
            </p>
          )}

          {/* Manual fallback */}
          <Troubleshoot label={isPaired ? 'Change display address' : 'Display not found after 1 minute?'}>
            <p className="text-xs text-gray-500">
              {platform === 'macos' ? 'Find the address in System Settings → Bluetooth, or run ' : 'Find the address in Settings → Bluetooth, or run '}
              <code className="bg-gray-100 px-1 rounded">
                {platform === 'macos' ? 'bumeet-agent --scan' : '.\\bumeet-agent.exe --scan'}
              </code>
              {' '}in a terminal.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">BLE Device Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={platform === 'windows' ? 'XX:XX:XX:XX:XX:XX' : 'XX:XX:XX:XX:XX:XX  or  XXXXXXXX-XXXX-…'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <details>
                <summary className="text-xs text-gray-400 cursor-pointer select-none">Characteristic UUID (advanced)</summary>
                <input
                  type="text"
                  value={uuid}
                  onChange={e => setUuid(e.target.value)}
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">Pre-filled with the CoreInk default. Only change if you use custom firmware.</p>
              </details>
              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving || !address.trim()}
                  className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
                {saveStatus === 'saved' && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle size={14} /> Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle size={14} /> Failed to save
                  </span>
                )}
              </div>
            </div>
          </Troubleshoot>
        </div>
      </section>

      {/* Step 4 — Done */}
      <section>
        <StepHeader n={4} done={isPaired && pairStatus === 'done'} title="You're all set" />
        <div className="ml-8 text-sm text-gray-500">
          {isPaired && pairStatus === 'done' ? (
            <p className="text-green-600 flex items-center gap-1">
              <CheckCircle size={14} /> The display will show your live presence status.
              Check the <a href="/status" className="underline">Status page</a> for battery and signal.
            </p>
          ) : (
            <p>Once the agent is linked and the display is found, your door display will update automatically.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StepHeader({ n, done, title }: { n: number; done: boolean; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={cn(
        'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
        done ? 'bg-green-500 text-white' : 'bg-brand-500 text-white'
      )}>
        {done ? <CheckCircle size={14} /> : n}
      </span>
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

export default function DevicePageWrapper() {
  return (
    <Suspense>
      <DevicePage />
    </Suspense>
  );
}
