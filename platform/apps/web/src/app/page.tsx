'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconSlack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M14.5 10a2 2 0 1 1-2-2h2v2ZM12.5 10h-7a2 2 0 0 0 0 4h7v-4Z" />
      <path d="M9.5 14a2 2 0 1 1 2 2v-2h-2ZM11.5 14h7a2 2 0 0 0 0-4h-7v4Z" />
    </svg>
  );
}
function IconBluetooth() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="m6.5 6.5 11 11L12 23V1l5.5 5.5-11 11" />
    </svg>
  );
}
function IconBattery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <rect x="2" y="7" width="18" height="10" rx="2" />
      <path d="M22 11v2" strokeLinecap="round" />
      <path d="M6 11h6" strokeLinecap="round" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}
function IconApple() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
    </svg>
  );
}
function IconWindows() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}
function IconLinux() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.4-.178-.868-.506-1.335-.322-.384-.927-.977-1.61-1.753-1.293-1.736-1.664-3.967-1.215-5.487.115-.39.295-.756.526-1.076.389-.532.78-1.028.899-1.637.126-.647-.024-1.34-.348-1.942-.324-.6-.789-1.086-1.374-1.432-.585-.347-1.275-.536-1.974-.536-.04 0-.08 0-.12.002zm-.005 6.207c.175 0 .35.017.523.05.6.118 1.1.447 1.386.903.285.456.35.989.162 1.488-.386 1.024-1.527 1.52-2.52 1.105-.995-.414-1.47-1.552-1.085-2.576.311-.826 1.128-1.37 1.534-.97zm-.94 5.37c.305 0 .594.067.875.2.587.267 1.028.8 1.17 1.401.142.6-.012 1.235-.407 1.643a2.13 2.13 0 01-1.638.668c-.61.014-1.219-.273-1.607-.763a2.077 2.077 0 01-.362-1.73c.215-.81.975-1.419 1.97-1.419zm4.938.99c.305 0 .618.069.9.216.577.295 1.006.867 1.12 1.512.114.644-.088 1.313-.527 1.712-.44.4-1.087.55-1.686.38-.598-.17-1.08-.662-1.264-1.283a2.07 2.07 0 01.375-1.97c.323-.374.78-.567 1.082-.567z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── EinkDevice illustration ──────────────────────────────────────────────────

function EinkPreview({ busy }: { busy: boolean }) {
  return (
    <div className="relative mx-auto" style={{ width: 160, height: 180 }}>
      {/* Body */}
      <div className="absolute inset-0 rounded-2xl shadow-2xl" style={{ background: 'linear-gradient(160deg,#2d2d2d,#1a1a1a)' }} />
      {/* Screen bezel */}
      <div className="absolute rounded-xl" style={{ top: 18, left: 14, right: 14, bottom: 38, background: '#111' }}>
        {/* E-ink screen */}
        <div className="absolute inset-1.5 rounded-lg overflow-hidden bg-[#e8e4d8] flex flex-col items-center justify-center">
          {busy ? (
            <>
              <div className="w-full py-2 bg-black flex items-center justify-center">
                <span className="text-white font-bold text-lg tracking-wider">BUSY</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2">
                <span className="text-[9px] text-gray-700 font-medium text-center leading-tight">Google Calendar</span>
                <span className="text-[9px] text-gray-500">ends 15:30</span>
              </div>
            </>
          ) : (
            <span className="font-bold text-2xl tracking-widest text-gray-900">FREE</span>
          )}
        </div>
      </div>
      {/* LED */}
      <div className={`absolute rounded-full w-2 h-2 ${busy ? 'bg-red-400' : 'bg-green-400'}`} style={{ top: 10, left: '50%', transform: 'translateX(-50%)' }} />
      {/* Buttons */}
      {[28, 50, 72].map((t) => (
        <div key={t} className="absolute right-1.5 w-2 h-5 rounded-full bg-gray-600" style={{ top: t }} />
      ))}
      {/* USB-C */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-6 h-2 rounded-sm bg-gray-700" />
      {/* Label */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-gray-500 font-bold" style={{ fontSize: 7, letterSpacing: 2 }}>M5STACK COREINK</span>
      </div>
    </div>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <IconCheck />
        </div>
        <p className="text-lg font-semibold text-gray-900">Message sent!</p>
        <p className="text-gray-500 text-sm">I'll get back to you as soon as possible.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="How can I help you?"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="self-start px-8 py-3 rounded-xl bg-brand font-semibold text-white text-sm hover:bg-brand-600 transition-colors disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <IconMonitor />, title: 'Camera & mic detection', desc: 'Detects active hardware on macOS, Windows and Linux — no manual toggles.' },
  { icon: <IconCalendar />, title: 'Calendar sync', desc: 'Pulls live events from Google Calendar and Microsoft Calendar.' },
  { icon: <IconSlack />, title: 'Slack presence', desc: 'Reads your real-time call status directly from the Slack API.' },
  { icon: <IconBluetooth />, title: 'BLE e-ink display', desc: 'Sends FREE / BUSY to your M5Stack CoreInk over Bluetooth Low Energy.' },
  { icon: <IconBattery />, title: 'Weeks of battery', desc: 'Deep-sleep firmware keeps the display running for weeks on a single charge.' },
  { icon: <IconZap />, title: 'Instant transitions', desc: 'State changes are detected and propagated in under a second.' },
];

const STEPS = [
  { n: '01', title: 'Install the agent', desc: 'Download and run the lightweight background agent on your computer. It starts silently on login.' },
  { n: '02', title: 'Connect your display', desc: 'Power on the M5Stack CoreInk. The agent finds it over BLE and starts sending status updates.' },
  { n: '03', title: 'Sync your tools', desc: 'Connect Google Calendar, Microsoft Calendar, and Slack in the web dashboard. Done.' },
];

// GitHub Releases base — update REPO_SLUG when the repo is public/renamed
const RELEASES_BASE = 'https://github.com/bumeet/bumeet/releases/latest/download';

const DOWNLOADS = [
  { icon: <IconApple />, label: 'macOS', sub: 'Apple Silicon & Intel', href: `${RELEASES_BASE}/bumeet-agent-macos` },
  { icon: <IconWindows />, label: 'Windows', sub: '64-bit', href: `${RELEASES_BASE}/bumeet-agent-windows.exe` },
  { icon: <IconLinux />, label: 'Linux', sub: 'x86_64', href: `${RELEASES_BASE}/bumeet-agent-linux` },
];

export default function LandingPage() {
  const [busyPreview, setBusyPreview] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight" style={{ color: '#6C47FF' }}>BUMEET</span>
          <nav className="hidden sm:flex items-center gap-8 text-sm text-gray-600">
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#download" className="hover:text-gray-900 transition-colors">Download</a>
            <a href="#contact" className="hover:text-gray-900 transition-colors">Contact</a>
          </nav>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Open beta
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-900">
            Your desk,<br />
            <span style={{ color: '#6C47FF' }}>always in sync</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg">
            BUMEET combines your calendar, Slack status, and camera activity into a single FREE / BUSY signal — displayed on an e-ink screen on your desk.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#download"
              className="px-6 py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-600 transition-colors flex items-center gap-2"
            >
              Download agent <IconArrow />
            </a>
            <Link
              href="/login"
              className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        {/* Interactive device preview */}
        <div className="flex flex-col items-center gap-6">
          <EinkPreview busy={busyPreview} />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBusyPreview(false)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${!busyPreview ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              FREE
            </button>
            <button
              onClick={() => setBusyPreview(true)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${busyPreview ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              BUSY
            </button>
          </div>
          <p className="text-xs text-gray-400">Interactive preview of the M5Stack CoreInk display</p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
            <p className="mt-3 text-gray-500">Up and running in minutes, no technical knowledge required.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-4xl font-black mb-4" style={{ color: '#6C47FF', opacity: 0.15 }}>{n}</div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Everything you need</h2>
          <p className="mt-3 text-gray-500">Built for people who focus deeply and need the world to know it.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="group p-6 rounded-2xl border border-gray-100 hover:border-brand-100 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: '#f0edff', color: '#6C47FF' }}>
                {icon}
              </div>
              <h3 className="font-bold mb-1.5">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Download ── */}
      <section id="download" className="py-24" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #4826dd 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Download BUMEET Agent</h2>
          <p className="mt-3 text-white/70 max-w-md mx-auto">
            The agent runs silently in the background and communicates with your display over Bluetooth.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {DOWNLOADS.map(({ icon, label, sub, href }) => (
              <a
                key={label}
                href={href}
                className="group flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-left"
              >
                <div className="text-white">{icon}</div>
                <div>
                  <div className="text-white font-bold text-sm">{label}</div>
                  <div className="text-white/60 text-xs">{sub}</div>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-8 text-white/40 text-xs">
            Requires Python 3.11+ · Bluetooth LE adapter · M5Stack CoreInk
          </p>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-24 max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Get in touch</h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Questions about setup, feature requests, or anything else — I'm happy to help.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Hardware setup support',
                'Integration questions',
                'Feature requests',
                'Business inquiries',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f0edff', color: '#6C47FF' }}>
                    <IconCheck />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-bold" style={{ color: '#6C47FF' }}>BUMEET</span>
          <span>© {new Date().getFullYear()} Antonio Rodes · All rights reserved</span>
          <nav className="flex gap-6">
            <a href="#how-it-works" className="hover:text-gray-600 transition-colors">Docs</a>
            <a href="#contact" className="hover:text-gray-600 transition-colors">Contact</a>
            <Link href="/login" className="hover:text-gray-600 transition-colors">Dashboard</Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
