'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Bluetooth, Terminal, CheckCircle, AlertCircle,
  Loader2, Download, Copy, Check, Monitor, Link,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
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

function DevicePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [platform, setPlatform] = useState<Platform>('macos');
  const [config, setConfig] = useState<BleConfig>({ deviceAddress: null, characteristicUuid: null });
  const [address, setAddress] = useState('');
  const [uuid, setUuid] = useState(DEFAULT_CHAR_UUID);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Pairing code state
  const [pairCode, setPairCode] = useState('');
  const [pairStatus, setPairStatus] = useState<'idle' | 'linking' | 'done' | 'error'>('idle');
  const pairRef = useRef(pairCode);
  pairRef.current = pairCode;

  const token = session?.apiToken;

  const macCmd = token
    ? `curl -fsSL https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-macos.sh | bash -s -- --token ${token}`
    : `curl -fsSL https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-macos.sh | bash`;

  const winCmd = token
    ? `irm https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-windows.ps1 | iex; # then: .\\install.ps1 -Token ${token}`
    : `irm https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-windows.ps1 | iex`;

  const winCmdFull = token
    ? `& ([scriptblock]::Create((irm https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-windows.ps1))) -Token "${token}"`
    : `irm https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-windows.ps1 | iex`;

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
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-semibold text-gray-800">Install the desktop agent</h2>
        </div>

        {/* Platform tabs */}
        <div className="ml-8 mb-3 flex gap-2">
          {(['macos', 'windows'] as Platform[]).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                platform === p
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Monitor size={14} />
              {p === 'macos' ? 'macOS' : 'Windows'}
            </button>
          ))}
        </div>

        {platform === 'macos' && (
          <div className="ml-8 space-y-2">
            <p className="text-sm text-gray-500">
              Run this in <strong>Terminal</strong>. The agent starts automatically at login.
            </p>
            <CopyBlock value={macCmd} />
            <p className="text-xs text-gray-400">
              Requires macOS 13+.{' '}
              <a
                href="https://github.com/bumeet/bumeet/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                <Download size={11} />Download manually
              </a>
            </p>
          </div>
        )}

        {platform === 'windows' && (
          <div className="ml-8 space-y-2">
            <p className="text-sm text-gray-500">
              Run this in <strong>PowerShell</strong> (no admin required). The agent registers as a scheduled task that starts at login.
            </p>
            <CopyBlock value={winCmdFull} />
            <p className="text-xs text-gray-400">
              Requires Windows 10/11 with PowerShell 5.1+.{' '}
              <a
                href="https://github.com/bumeet/bumeet/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                <Download size={11} />Download .exe manually
              </a>
            </p>
          </div>
        )}
      </section>

      {/* Step 2 — Link agent (pairing code) */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="font-semibold text-gray-800">Link the agent to your account</h2>
          {pairStatus === 'done' && <CheckCircle size={16} className="text-green-500" />}
        </div>
        <div className="ml-8 space-y-3">
          {pairStatus === 'linking' && (
            <p className="text-sm text-brand-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Linking agent automatically…
            </p>
          )}
          {pairStatus === 'idle' && (
            <p className="text-sm text-gray-500">
              When you install the agent it opens this page automatically and links itself.
              If that didn&apos;t happen, enter the code shown in the Terminal:
            </p>
          )}
          {pairStatus === 'idle' && (
            <div className="flex gap-2 items-start">
              <input
                type="text"
                maxLength={6}
                value={pairCode}
                onChange={e => { setPairCode(e.target.value.toUpperCase()); setPairStatus('idle'); }}
                placeholder="A3K7P2"
                className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={linkAgent}
                disabled={pairCode.trim().length !== 6}
                className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Link size={14} /> Link agent
              </button>
            </div>
          )}
          {pairStatus === 'done' && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} /> Agent linked — the agent will connect automatically
            </p>
          )}
          {pairStatus === 'error' && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={14} /> Code not found or expired — check the agent log and try again
            </p>
          )}
        </div>
      </section>

      {/* Step 3 — BLE config */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">3</span>
          <h2 className="font-semibold text-gray-800">Configure your display</h2>
          {isPaired && <CheckCircle size={16} className="text-green-500" />}
        </div>
        <div className="ml-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              BLE Device Address
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder={platform === 'windows' ? 'e.g. XX:XX:XX:XX:XX:XX' : 'e.g. XX:XX:XX:XX:XX:XX  or  XXXXXXXX-XXXX-…'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              {platform === 'macos'
                ? 'Find it in System Settings → Bluetooth, or run '
                : 'Find it in Settings → Bluetooth, or run '}
              <code className="bg-gray-100 px-1 rounded">
                {platform === 'macos' ? 'bumeet-agent --scan' : '.\\bumeet-agent.exe --scan'}
              </code>
              {' '}in a terminal.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Characteristic UUID
            </label>
            <input
              type="text"
              value={uuid}
              onChange={e => setUuid(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pre-filled with the CoreInk default. Only change if you use custom firmware.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !address.trim()}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save configuration
            </button>

            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> Saved — agent will pick this up on next start
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle size={14} /> Failed to save, try again
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Step 4 — Verify */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">4</span>
          <h2 className="font-semibold text-gray-800">Verify the connection</h2>
        </div>
        <div className="ml-8 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          {isPaired ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span>
                Display configured:{' '}
                <code className="font-mono text-xs bg-green-50 px-1 rounded">{config.deviceAddress}</code>
              </span>
            </div>
          ) : (
            <p>Once the agent is running and the display is configured, the Status page will show battery level and live presence.</p>
          )}
        </div>
      </section>
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
