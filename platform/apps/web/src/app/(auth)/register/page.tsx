'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      await api.post('/auth/register', { name: form.name, email: form.email, password: form.password });
      const res = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      if (res?.error) setError('Registration succeeded but login failed. Please sign in.');
      else router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border p-8 shadow-lg animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-500 rounded-xl mb-4">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Create account</h1>
        <p className="text-muted-foreground mt-1 text-sm">Get started with BUMEET</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'Full name', key: 'name', type: 'text', placeholder: 'Your name' },
          { label: 'Email', key: 'email', type: 'email', placeholder: 'you@example.com' },
          { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
          { label: 'Confirm password', key: 'confirm', type: 'password', placeholder: '••••••••' },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key}>
            <label htmlFor={key} className="block text-sm font-medium text-foreground mb-1">{label}</label>
            <Input
              id={key}
              type={type}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              required
            />
          </div>
        ))}
        {form.password && (
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length >= i * 2 ? 'bg-brand-500' : 'bg-muted'}`} />
            ))}
          </div>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
      </p>
    </Card>
  );
}
