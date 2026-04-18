'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap, Wifi, ShieldCheck, ArrowRight, Check, ChevronRight,
  Monitor, Bluetooth, Battery, Users, Building2, Gift, Menu, X,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Accent: #0EA5E9 (sky-500) — tech blue
// Dark:   #0F172A (slate-900)
// Mid:    #64748B (slate-500)

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <span className="text-xl font-black tracking-tight text-slate-900">
          BU<span className="text-sky-500">MEET</span>
        </span>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
          <a href="#for-business" className="hover:text-slate-900 transition-colors">For Business</a>
          <a href="#download" className="hover:text-slate-900 transition-colors">Download</a>
          <a href="#contact" className="hover:text-slate-900 transition-colors">Contact</a>
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            Log In
          </a>
          <a href="#contact" className="px-5 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors shadow-sm shadow-sky-200">
            Request Demo
          </a>
        </div>

        {/* Mobile burger */}
        <button className="md:hidden p-2 text-slate-600" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm font-medium text-slate-700">
          <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
          <a href="#for-business" onClick={() => setOpen(false)}>For Business</a>
          <a href="#contact" onClick={() => setOpen(false)}>Contact</a>
          <hr className="border-slate-100" />
          <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="text-slate-500">Log In</a>
          <a href="#contact" className="px-5 py-2.5 rounded-lg bg-sky-500 text-white font-semibold text-center">
            Request Demo
          </a>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-32 pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            Now available for teams · Free 30-day trial
          </div>

          <h1 className="text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight text-slate-900">
            Stop the{' '}
            <span className="relative">
              <span className="relative z-10 text-sky-500">interruptions.</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-sky-100 -z-0 rounded" />
            </span>
            <br />
            Protect your team's focus.
          </h1>

          <p className="mt-6 text-xl text-slate-500 leading-relaxed max-w-xl">
            BUMEET is a wireless e-ink door display that automatically shows
            when someone is in a meeting — no cables, no apps to open,
            no action required.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-all shadow-lg shadow-sky-200 hover:shadow-sky-300"
            >
              Get a Demo for your Team
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-macos.zip"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm hover:border-sky-300 hover:bg-sky-50 transition-all"
            >
              Buy for Myself
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-400">
            <div className="flex -space-x-2">
              {['#6C47FF','#0EA5E9','#10B981','#F59E0B'].map(c => (
                <div key={c} className="w-7 h-7 rounded-full border-2 border-white" style={{ background: c }} />
              ))}
            </div>
            <span>Trusted by <strong className="text-slate-600">500+ remote workers</strong> across Europe</span>
          </div>
        </div>

        {/* Product visual */}
        <div className="relative flex items-center justify-center">
          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-radial from-sky-100 to-transparent rounded-full blur-3xl opacity-60" />

          {/* Door illustration */}
          <div className="relative">
            <div
              className="relative rounded-2xl border-8 border-slate-300 bg-gradient-to-b from-amber-50 to-amber-100 shadow-2xl"
              style={{ width: 260, height: 340 }}
            >
              {/* Door panel lines */}
              <div className="absolute inset-4 rounded-lg border-2 border-amber-200/60" />
              <div className="absolute inset-8 rounded border border-amber-200/40" />
              {/* Knob */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-yellow-400 shadow-md" />
                <div className="w-1 h-6 bg-yellow-300 rounded-full" />
              </div>

              {/* BUMEET device */}
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 60 }}>
                <EinkDevice />
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -right-6 top-8 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Auto-detected · 0ms
              </div>
              <div className="text-slate-400 mt-0.5">Zoom call started</div>
            </div>

            <div className="absolute -left-6 bottom-12 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-sky-600 font-bold">
                <Battery size={12} />
                Battery: 11 months
              </div>
              <div className="text-slate-400 mt-0.5">Last charged: Jan 2025</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── E-ink device ─────────────────────────────────────────────────────────────

function EinkDevice() {
  const [busy, setBusy] = useState(true);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 130, height: 160 }}>
        <div className="absolute inset-0 rounded-xl shadow-xl" style={{ background: 'linear-gradient(160deg,#2d2d2d,#1a1a1a)' }} />
        <div className="absolute rounded-lg" style={{ top: 12, left: 10, right: 10, bottom: 32, background: '#111' }}>
          <div className={`absolute inset-1 rounded-md overflow-hidden flex flex-col ${busy ? 'bg-slate-900' : 'bg-[#e8e4d8]'}`}>
            {busy ? (
              <>
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-2">
                  <span className="text-[9px] text-slate-400 font-medium tracking-widest uppercase">In a meeting</span>
                  <span className="text-[#e8e4d8] font-black text-lg tracking-wider">BUSY</span>
                  <span className="text-[7px] text-slate-500 mt-1">Ends · 16:00</span>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <span className="text-slate-800 font-black text-sm tracking-widest">AVAILABLE</span>
                <span className="text-[7px] text-slate-400 mt-1">Come on in</span>
              </div>
            )}
          </div>
        </div>
        <div className={`absolute rounded-full w-1.5 h-1.5 ${busy ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ top: 7, left: '50%', transform: 'translateX(-50%)' }} />
        {[22, 38, 54].map(t => (
          <div key={t} className="absolute right-1 w-1.5 h-4 rounded-full bg-slate-700" style={{ top: t }} />
        ))}
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-slate-600 font-bold" style={{ fontSize: 5, letterSpacing: 2 }}>BUMEET</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setBusy(false)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${!busy ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
        >
          Available
        </button>
        <button
          onClick={() => setBusy(true)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${busy ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
        >
          Busy
        </button>
      </div>
    </div>
  );
}

// ─── Value Props ──────────────────────────────────────────────────────────────

const VALUE_PROPS = [
  {
    icon: <Zap size={22} />,
    tag: 'Instant Sync',
    title: 'Detects every call. Automatically.',
    desc: 'BUMEET listens for camera and microphone activity across Zoom, Teams, Google Meet and Slack — the display updates before your first word.',
  },
  {
    icon: <Wifi size={22} />,
    tag: 'Zero Wires',
    title: 'E-ink display. BLE. One-year battery.',
    desc: 'E-ink only draws power when the content changes. A single charge lasts up to 12 months. No power adapter, no USB cable, no Wi-Fi setup.',
  },
  {
    icon: <ShieldCheck size={22} />,
    tag: 'Privacy First',
    title: 'Everything stays on your machine.',
    desc: "No cloud processing. No cameras. No microphones recording. The agent runs entirely on your computer and communicates directly with the display over Bluetooth.",
  },
];

function ValueProps() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">Why BUMEET</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Built for deep work.<br />Designed to disappear.
          </h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">
            No dashboards to check, no statuses to update. BUMEET just works.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {VALUE_PROPS.map(({ icon, tag, title, desc }) => (
            <div key={tag} className="group relative p-8 rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-50 transition-all duration-300 bg-white">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center mb-6 group-hover:bg-sky-500 group-hover:text-white transition-colors duration-300">
                {icon}
              </div>
              <p className="text-xs font-bold text-sky-500 tracking-widest uppercase mb-2">{tag}</p>
              <h3 className="text-lg font-black text-slate-900 mb-3 leading-snug">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    icon: <Monitor size={20} />,
    title: 'Install the agent',
    desc: 'Download the lightweight background app for macOS, Windows or Linux. It launches silently at login — no configuration needed.',
  },
  {
    n: '02',
    icon: <Bluetooth size={20} />,
    title: 'Connect your display',
    desc: 'Stick the BUMEET screen on your door. Power it on. The agent finds it automatically over Bluetooth Low Energy.',
  },
  {
    n: '03',
    icon: <ShieldCheck size={20} />,
    title: 'Work without interruptions',
    desc: 'Join any call. The door screen updates in under a second. Your colleagues know instantly — no knocking, no "are you free?" messages.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">Setup in minutes</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Three steps to zero interruptions.
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent" />

          {STEPS.map(({ n, icon, title, desc }) => (
            <div key={n} className="relative bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-200 flex-shrink-0">
                  {icon}
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-black flex items-center justify-center">
                    {n.replace('0', '')}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{title}</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── B2B / Enterprise ─────────────────────────────────────────────────────────

const B2B_FEATURES = [
  'Custom logo on idle screen (screensaver mode)',
  'Bulk onboarding — deploy to 100 devices in minutes',
  'Branded Welcome Pack for new hires',
  'Centralized device management dashboard',
  'Volume pricing from 10 units',
  'Dedicated account manager + SLA',
];

// ─── Download ─────────────────────────────────────────────────────────────────

const DOWNLOADS = [
  {
    os: 'macOS',
    sub: 'Apple Silicon & Intel · macOS 12+',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-macos.zip',
    note: 'Right-click → Open on first launch',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
      </svg>
    ),
  },
  {
    os: 'Windows',
    sub: '64-bit · Windows 10+',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-windows.exe',
    note: 'Run the .exe directly',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
  },
  {
    os: 'Linux',
    sub: 'x86_64 · Ubuntu, Debian, Fedora',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-linux',
    note: 'chmod +x before running',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.4-.178-.868-.506-1.335-.322-.384-.927-.977-1.61-1.753-1.293-1.736-1.664-3.967-1.215-5.487.115-.39.295-.756.526-1.076.389-.532.78-1.028.899-1.637.126-.647-.024-1.34-.348-1.942-.324-.6-.789-1.086-1.374-1.432-.585-.347-1.275-.536-1.974-.536z" />
      </svg>
    ),
  },
];

function DownloadSection() {
  return (
    <section id="download" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">Free download</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Download BUMEET Agent
          </h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">
            The background agent runs silently on your computer and updates your door display automatically over Bluetooth.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {DOWNLOADS.map(({ os, sub, href, note, icon }) => (
            <a
              key={os}
              href={href}
              className="group flex flex-col items-center gap-5 p-8 rounded-2xl border-2 border-slate-100 hover:border-sky-400 hover:shadow-xl hover:shadow-sky-50 transition-all duration-200 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-sky-50 text-slate-500 group-hover:text-sky-500 flex items-center justify-center transition-colors duration-200">
                {icon}
              </div>
              <div>
                <div className="text-lg font-black text-slate-900">{os}</div>
                <div className="text-sm text-slate-400 mt-1">{sub}</div>
              </div>
              <div className="mt-auto w-full py-2.5 rounded-xl bg-slate-900 group-hover:bg-sky-500 text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2">
                Download <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-400">{note}</p>
            </a>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Open source · <a href="https://github.com/bumeet/bumeet" className="text-sky-500 hover:underline" target="_blank" rel="noopener noreferrer">View on GitHub</a> · Latest release: v0.1.0
        </p>
      </div>
    </section>
  );
}

function ForBusiness() {
  return (
    <section id="for-business" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>

          {/* Left: copy */}
          <div className="p-12 lg:p-16 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-bold mb-8 w-fit">
              <Building2 size={12} />
              For HR &amp; People Teams
            </div>

            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
              The best welcome gift<br />
              <span className="text-sky-400">you've never thought of.</span>
            </h2>

            <p className="mt-6 text-slate-400 text-lg leading-relaxed">
              Remote and hybrid workers lose an average of <strong className="text-white">2.1 hours per day</strong> to unnecessary interruptions. BUMEET is the wellness tool that pays for itself in the first week.
            </p>

            <p className="mt-4 text-slate-400 leading-relaxed">
              Include it in your onboarding Welcome Pack. Show your team you take their focus seriously — with your company logo displayed on every screen.
            </p>

            <ul className="mt-8 space-y-3">
              {B2B_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center flex-shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#contact" className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/30">
                Talk to Sales
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="#contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-sm hover:border-slate-400 hover:text-white transition-colors">
                Download Brochure
              </a>
            </div>
          </div>

          {/* Right: metrics */}
          <div className="p-12 lg:p-16 flex flex-col justify-center gap-8 border-t lg:border-t-0 lg:border-l border-slate-700/50">
            {[
              { icon: <Users size={20} />, stat: '500+', label: 'Remote workers protected' },
              { icon: <Gift size={20} />, stat: '#1', label: 'Rated onboarding gift in remote-first surveys' },
              { icon: <Battery size={20} />, stat: '12mo', label: 'Average battery life per device' },
              { icon: <Zap size={20} />, stat: '<1s', label: 'Display update latency' },
            ].map(({ icon, stat, label }) => (
              <div key={stat} className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-slate-700/60 text-sky-400 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <div className="text-3xl font-black text-white">{stat}</div>
                  <div className="text-sm text-slate-400 mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
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

  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">Get in touch</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            Ready to protect your team's focus?
          </h2>
          <p className="mt-4 text-slate-500 text-lg">
            Request a demo, ask about bulk pricing, or just say hello.
          </p>
        </div>

        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Check size={24} className="text-emerald-500" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-black text-slate-900">We'll be in touch shortly.</h3>
              <p className="text-slate-500 text-sm">Our team typically responds within one business day.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                    placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Work Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                    placeholder="jane@company.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Company</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                  placeholder="Acme Corp (optional)" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Message</label>
                <textarea required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition resize-none"
                  placeholder="I'm looking for 50 units for our remote team onboarding..." />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors shadow-md shadow-sky-200 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? 'Sending…' : (<>Send Message <ChevronRight size={15} /></>)}
              </button>
              <p className="text-center text-xs text-slate-400">
                Or email us directly at{' '}
                <a href="mailto:hello@bumeet.es" className="text-sky-500 font-semibold hover:underline">hello@bumeet.es</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-lg font-black text-white">BU<span className="text-sky-500">MEET</span></span>
            <p className="text-xs mt-1">Protecting focus, one door at a time.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#for-business" className="hover:text-white transition-colors">For Business</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Log In</a>
          </nav>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} BUMEET · Antonio Rodes · All rights reserved
          </p>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 flex flex-wrap justify-center gap-6 text-xs text-slate-600">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>
            macOS: right-click → Open on first launch (app not yet notarized)
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <Nav />
      <Hero />
      <ValueProps />
      <HowItWorks />
      <DownloadSection />
      <ForBusiness />
      <Contact />
      <Footer />
    </div>
  );
}
