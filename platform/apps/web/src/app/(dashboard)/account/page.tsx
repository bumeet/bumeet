'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { api } from '@/lib/api';
import { Save, Trash2, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type UserProfile = { id: string; email: string; name: string; avatarUrl?: string; timezone: string; language: string };
type Session = { id: string; userAgent?: string; ipAddress?: string; createdAt: string; expiresAt: string };

const TIMEZONES = ['UTC', 'Europe/Madrid', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo'];
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }];

export default function AccountPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<UserProfile>('/users/me', token).then(setProfile);
    api.get<Session[]>('/users/me/sessions', token).then(setSessions);
  }, [token]);

  const handleSaveProfile = async () => {
    if (!token || !profile) return;
    setSaving(true);
    try {
      const updated = await api.patch<UserProfile>('/users/me', { name: profile.name, timezone: profile.timezone, language: profile.language }, token);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    setPwError('');
    if (passwords.next !== passwords.confirm) return setPwError('Passwords do not match');
    if (passwords.next.length < 8) return setPwError('Password must be at least 8 characters');
    try {
      await api.patch('/users/me/password', { currentPassword: passwords.current, newPassword: passwords.next }, token);
      setPasswords({ current: '', next: '', confirm: '' });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!token) return;
    await api.delete(`/users/me/sessions/${id}`, token);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDeleteAccount = async () => {
    if (!token || !confirm('Are you sure? This will permanently delete your account and all data.')) return;
    await api.delete('/users/me', token);
    signOut({ callbackUrl: '/login' });
  };

  if (!profile) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-gray-500 mt-1">Manage your profile and security settings.</p>
      </div>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-4">
          <Field label="Full name">
            <input value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="input" />
          </Field>
          <Field label="Email">
            <input value={profile.email} disabled className="input opacity-60 cursor-not-allowed" />
          </Field>
          <Field label="Timezone">
            <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="input">
              {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Language">
            <select value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })} className="input">
              {LANGUAGES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
              <Save size={14} /> {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield size={16} /> Security</h2>
        <div className="space-y-3 mb-4">
          {[{ label: 'Current password', key: 'current' }, { label: 'New password', key: 'next' }, { label: 'Confirm new password', key: 'confirm' }].map(({ label, key }) => (
            <Field key={key} label={label}>
              <input type="password" value={passwords[key as keyof typeof passwords]} onChange={(e) => setPasswords((p) => ({ ...p, [key]: e.target.value }))} className="input" />
            </Field>
          ))}
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          {pwSaved && <p className="text-sm text-green-600">Password changed!</p>}
          <button onClick={handleChangePassword} className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">
            Change password
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Active sessions</h3>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-gray-900">{s.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-gray-400">{s.ipAddress || ''} · Active {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</p>
                </div>
                <button onClick={() => handleRevokeSession(s.id)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Revoke</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-semibold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-500 mb-4">Once you delete your account, there is no going back.</p>
        <button onClick={handleDeleteAccount} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Trash2 size={14} /> Delete account
        </button>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
