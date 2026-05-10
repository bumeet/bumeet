'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Bluetooth, Terminal, CheckCircle, AlertCircle, Loader2, Download, Copy, Check } from 'lucide-react';

const DEFAULT_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface BleConfig {
  deviceAddress: string | null;
  characteristicUuid: string | null;
}

export default function DevicePage() {
  const { data: session } = useSession();
  const [config, setConfig] = useState<BleConfig>({ deviceAddress: null, characteristicUuid: null });
  const [address, setAddress] = useState('');
  const [uuid, setUuid] = useState(DEFAULT_CHAR_UUID);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  const token = (session as any)?.apiToken as string | undefined;
  const installCmd = token
    ? `curl -fsSL https://bumeet.es/install.sh | bash -s -- --token ${token}`
    : `curl -fsSL https://bumeet.es/install.sh | bash`;

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

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!token || !address.trim() || !uuid.trim()) return;
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch(`${API_URL}/device/ble-config`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceAddress: address.trim(), characteristicUuid: uuid.trim() }),
      });
      if (res.ok) {
        const data: BleConfig = await res.json();
        setConfig(data);
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  function copyInstallCmd() {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-semibold text-gray-800">Install the desktop agent</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3 ml-8">
          Run this command in Terminal on your Mac. The agent starts automatically at login.
        </p>
        <div className="ml-8 bg-gray-900 rounded-lg p-4 flex items-start gap-3">
          <Terminal size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <code className="text-green-400 text-sm break-all flex-1">{installCmd}</code>
          <button
            onClick={copyInstallCmd}
            className="shrink-0 text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 ml-8">
          Requires macOS 13+.{' '}
          <a href="https://github.com/bumeet/bumeet/releases/latest" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
            <Download size={11} /> Download manually
          </a>
        </p>
      </section>

      {/* Step 2 — BLE config */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">2</span>
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
              placeholder="e.g. XX:XX:XX:XX:XX:XX  or  XXXXXXXX-XXXX-…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find it in System Settings → Bluetooth, or run <code className="bg-gray-100 px-1 rounded">bumeet-agent --scan</code> in Terminal.
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
              Pre-filled with the CoreInk default. Only change if you use a custom firmware.
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

            {status === 'saved' && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> Saved — agent will pick this up on next start
              </span>
            )}
            {status === 'error' && (
              <span className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle size={14} /> Failed to save, try again
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Step 3 — Verify */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">3</span>
          <h2 className="font-semibold text-gray-800">Verify the connection</h2>
        </div>
        <div className="ml-8 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          {isPaired ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span>
                Display configured: <code className="font-mono text-xs bg-green-50 px-1 rounded">{config.deviceAddress}</code>
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
