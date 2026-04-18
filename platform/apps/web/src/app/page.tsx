'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Icons ───────────────────────────────────────────────────────────────────

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
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
      <path d="M23 7 16 12l7 5V7Z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
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

// ─── Translations ─────────────────────────────────────────────────────────────

type Lang = 'es' | 'en';

const T = {
  es: {
    nav: { howItWorks: 'Cómo funciona', features: 'Características', download: 'Descarga', contact: 'Contacto', signin: 'Acceder' },
    badge: 'Beta abierta',
    heroTitle: ['La puerta que', 'habla por ti'],
    heroDesc: 'BUMEET es una pantalla e-ink que se coloca en la puerta de tu habitación u oficina. Muestra automáticamente si estás disponible, en reunión o no quieres que te interrumpan — sin que tengas que hacer nada.',
    heroCta: 'Descargar agente',
    heroSub: 'Ver cómo funciona',
    previewCaption: 'Vista previa interactiva de la pantalla en la puerta',
    modes: ['Disponible', 'En reunión', 'No molestar'],
    howTitle: 'Cómo funciona',
    howSub: 'Listo en minutos. Sin configuración técnica.',
    steps: [
      { n: '01', title: 'Coloca la pantalla en la puerta', desc: 'Fija el dispositivo en la puerta de tu habitación u oficina. Funciona con cualquier superficie.' },
      { n: '02', title: 'Instala el agente en tu ordenador', desc: 'Descarga e instala la aplicación de fondo. Arranca sola al iniciar sesión y no necesita atención.' },
      { n: '03', title: 'Trabaja sin interrupciones', desc: 'La pantalla se actualiza sola cuando entras en una reunión, una llamada o pones un mensaje manual.' },
    ],
    featTitle: 'Todo lo que necesitas',
    featSub: 'Pensado para personas que necesitan concentrarse y no quieren interrupciones.',
    features: [
      { title: 'Detección automática', desc: 'Detecta cuando tienes la cámara o el micrófono activos en macOS, Windows y Linux. Sin tocar nada.' },
      { title: 'Sincronización de calendario', desc: 'Se conecta con Google Calendar y Microsoft Calendar para mostrar tus reuniones en tiempo real.' },
      { title: 'Estado de Slack', desc: 'Lee tu estado de llamada en Slack y actualiza la pantalla al instante.' },
      { title: 'Mensaje personalizado', desc: 'Pon cualquier mensaje desde tu ordenador: "No molestar", "Vuelvo en 10 min" o lo que necesites.' },
      { title: 'Conexión inalámbrica', desc: 'Comunicación por Bluetooth Low Energy. Sin cables, sin configuración de red.' },
      { title: 'Meses de batería', desc: 'La pantalla e-ink consume energía solo al cambiar. Una carga dura semanas o meses.' },
    ],
    dlTitle: 'Descarga el agente BUMEET',
    dlDesc: 'Se ejecuta en segundo plano y se comunica con la pantalla de tu puerta por Bluetooth. Sin consumo notable de recursos.',
    dlNote: 'Requiere Bluetooth LE · Compatible con macOS 12+, Windows 10+ y Linux',
    contactTitle: 'Contacto',
    contactDesc: '¿Tienes preguntas sobre la configuración, quieres más información o tienes alguna propuesta? Escríbeme.',
    contactItems: ['Soporte para la configuración del hardware', 'Preguntas sobre integraciones', 'Sugerencias de mejora', 'Consultas comerciales o de distribución'],
    formName: 'Nombre', formEmail: 'Email', formMsg: 'Mensaje',
    formNamePh: 'Tu nombre', formEmailPh: 'tu@email.com', formMsgPh: '¿En qué puedo ayudarte?',
    formSend: 'Enviar mensaje', formSending: 'Enviando…',
    formOkTitle: '¡Mensaje enviado!', formOkDesc: 'Te responderé lo antes posible.',
    footerRights: 'Todos los derechos reservados',
  },
  en: {
    nav: { howItWorks: 'How it works', features: 'Features', download: 'Download', contact: 'Contact', signin: 'Sign in' },
    badge: 'Open beta',
    heroTitle: ['The door that', 'speaks for you'],
    heroDesc: 'BUMEET is an e-ink screen you place on the door of your room or office. It automatically shows whether you are available, in a meeting, or do not want to be interrupted — without you doing a thing.',
    heroCta: 'Download agent',
    heroSub: 'See how it works',
    previewCaption: 'Interactive preview of the door display',
    modes: ['Available', 'In a meeting', 'Do not disturb'],
    howTitle: 'How it works',
    howSub: 'Up and running in minutes. No technical knowledge required.',
    steps: [
      { n: '01', title: 'Place the screen on the door', desc: 'Attach the device to the door of your room or office. Works on any surface.' },
      { n: '02', title: 'Install the agent on your computer', desc: 'Download and install the background app. It launches automatically on login and needs no attention.' },
      { n: '03', title: 'Work without interruptions', desc: 'The screen updates itself when you join a meeting, start a call, or set a manual message.' },
    ],
    featTitle: 'Everything you need',
    featSub: 'Built for people who need to focus deeply and want the world to know it.',
    features: [
      { title: 'Automatic detection', desc: 'Detects when your camera or microphone is active on macOS, Windows and Linux. No manual toggles.' },
      { title: 'Calendar sync', desc: 'Connects to Google Calendar and Microsoft Calendar to display your meetings in real time.' },
      { title: 'Slack status', desc: 'Reads your call status from Slack and updates the screen instantly.' },
      { title: 'Custom message', desc: 'Set any message from your computer: "Do not disturb", "Back in 10 min", or whatever you need.' },
      { title: 'Wireless connection', desc: 'Communicates over Bluetooth Low Energy. No cables, no network setup.' },
      { title: 'Months of battery', desc: 'The e-ink screen only consumes power when the content changes. One charge lasts weeks or months.' },
    ],
    dlTitle: 'Download BUMEET Agent',
    dlDesc: 'Runs silently in the background and communicates with your door display over Bluetooth. Negligible resource usage.',
    dlNote: 'Requires Bluetooth LE · Compatible with macOS 12+, Windows 10+ and Linux',
    contactTitle: 'Contact',
    contactDesc: 'Questions about setup, feature requests, or anything else — feel free to reach out.',
    contactItems: ['Hardware setup support', 'Integration questions', 'Feature requests', 'Business or distribution inquiries'],
    formName: 'Name', formEmail: 'Email', formMsg: 'Message',
    formNamePh: 'Your name', formEmailPh: 'you@example.com', formMsgPh: 'How can I help you?',
    formSend: 'Send message', formSending: 'Sending…',
    formOkTitle: 'Message sent!', formOkDesc: "I'll get back to you as soon as possible.",
    footerRights: 'All rights reserved',
  },
};

// ─── E-ink door display illustration ─────────────────────────────────────────

type DisplayMode = 'available' | 'meeting' | 'dnd';

function EinkDoorDisplay({ mode }: { mode: DisplayMode }) {
  const configs = {
    available: { bg: '#e8e4d8', headerBg: null, headerText: '', mainText: 'AVAILABLE', mainColor: '#1a1a1a', subText: '', dot: 'bg-green-400' },
    meeting:   { bg: '#e8e4d8', headerBg: '#1a1a1a', headerText: 'IN A MEETING', mainText: '', mainColor: '#1a1a1a', subText: 'Ends at 16:00', dot: 'bg-red-400' },
    dnd:       { bg: '#1a1a1a', headerBg: null, headerText: '', mainText: 'DO NOT\nDISTURB', mainColor: '#e8e4d8', subText: '', dot: 'bg-orange-400' },
  };
  const cfg = configs[mode];

  return (
    <div className="relative mx-auto" style={{ width: 160, height: 200 }}>
      <div className="absolute inset-0 rounded-2xl shadow-2xl" style={{ background: 'linear-gradient(160deg,#2d2d2d,#1a1a1a)' }} />
      <div className="absolute rounded-xl" style={{ top: 18, left: 14, right: 14, bottom: 42, background: '#111' }}>
        <div className="absolute inset-1.5 rounded-lg overflow-hidden flex flex-col" style={{ background: cfg.bg }}>
          {cfg.headerBg && (
            <div className="w-full py-1.5 flex items-center justify-center" style={{ background: cfg.headerBg }}>
              <span className="font-black text-[9px] tracking-widest" style={{ color: '#e8e4d8' }}>{cfg.headerText}</span>
            </div>
          )}
          <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2">
            {cfg.mainText && (
              <span className="font-black text-center leading-tight" style={{ color: cfg.mainColor, fontSize: cfg.mainText.includes('\n') ? 16 : 13, whiteSpace: 'pre-line', letterSpacing: 1 }}>
                {cfg.mainText}
              </span>
            )}
            {cfg.subText && (
              <span className="text-[8px] text-center mt-1" style={{ color: '#888' }}>{cfg.subText}</span>
            )}
          </div>
        </div>
      </div>
      <div className={`absolute rounded-full w-2 h-2 ${cfg.dot}`} style={{ top: 10, left: '50%', transform: 'translateX(-50%)' }} />
      {[28, 50, 72].map((t) => (
        <div key={t} className="absolute right-1.5 w-2 h-5 rounded-full bg-gray-600" style={{ top: t }} />
      ))}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-6 h-2 rounded-sm bg-gray-700" />
      <div className="absolute bottom-3 left-0 right-0 text-center">
        <span className="text-gray-500 font-bold" style={{ fontSize: 6, letterSpacing: 2 }}>BUMEET · E-INK</span>
      </div>
    </div>
  );
}

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ t }: { t: typeof T['es'] }) {
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
        <p className="text-lg font-semibold text-gray-900">{t.formOkTitle}</p>
        <p className="text-gray-500 text-sm">{t.formOkDesc}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.formName}</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t.formNamePh} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.formEmail}</label>
          <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t.formEmailPh} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t.formMsg}</label>
        <textarea required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder={t.formMsgPh} />
      </div>
      <button type="submit" disabled={loading}
        className="self-start px-8 py-3 rounded-xl bg-brand font-semibold text-white text-sm hover:bg-brand-600 transition-colors disabled:opacity-60">
        {loading ? t.formSending : t.formSend}
      </button>
    </form>
  );
}

// ─── Feature icons (ordered to match translation arrays) ─────────────────────

const FEATURE_ICONS = [<IconCamera key="cam" />, <IconCalendar key="cal" />, <IconSlack key="slack" />, <IconEdit key="edit" />, <IconBluetooth key="bt" />, <IconBattery key="bat" />];

const DOWNLOADS = [
  { icon: <IconApple />, label: 'macOS', sub: 'Apple Silicon & Intel', href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-macos.zip' },
  { icon: <IconWindows />, label: 'Windows', sub: '64-bit', href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-windows.exe' },
  { icon: <IconLinux />, label: 'Linux', sub: 'x86_64', href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-linux' },
];

const DISPLAY_MODES: DisplayMode[] = ['available', 'meeting', 'dnd'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es');
  const [mode, setMode] = useState<DisplayMode>('available');
  const t = T[lang];

  const howId    = lang === 'es' ? 'como-funciona' : 'how-it-works';
  const featId   = lang === 'es' ? 'caracteristicas' : 'features';
  const dlId     = lang === 'es' ? 'descarga' : 'download';
  const contId   = lang === 'es' ? 'contacto' : 'contact';

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight" style={{ color: '#6C47FF' }}>BUMEET</span>
          <nav className="hidden sm:flex items-center gap-7 text-sm text-gray-600">
            <a href={`#${howId}`} className="hover:text-gray-900 transition-colors">{t.nav.howItWorks}</a>
            <a href={`#${featId}`} className="hover:text-gray-900 transition-colors">{t.nav.features}</a>
            <a href={`#${dlId}`} className="hover:text-gray-900 transition-colors">{t.nav.download}</a>
            <a href={`#${contId}`} className="hover:text-gray-900 transition-colors">{t.nav.contact}</a>
          </nav>
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="flex items-center rounded-full border-2 border-gray-200 overflow-hidden text-sm font-bold shadow-sm">
              <button
                onClick={() => setLang('es')}
                className={`px-4 py-1.5 transition-colors ${lang === 'es' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
              >🇪🇸 ES</button>
              <div className="w-px h-5 bg-gray-200" />
              <button
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 transition-colors ${lang === 'en' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
              >🇬🇧 EN</button>
            </div>
            <Link href="/login" className="hidden sm:block px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-600 transition-colors">
              {t.nav.signin}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            {t.badge}
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-900">
            {t.heroTitle[0]}<br />
            <span style={{ color: '#6C47FF' }}>{t.heroTitle[1]}</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg">{t.heroDesc}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`#${dlId}`} className="px-6 py-3 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand-600 transition-colors flex items-center gap-2">
              {t.heroCta} <IconArrow />
            </a>
            <a href={`#${howId}`} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-colors">
              {t.heroSub}
            </a>
          </div>
        </div>

        {/* Interactive door preview */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative rounded-lg border-4 border-gray-300 bg-amber-50 shadow-xl" style={{ width: 220, height: 280 }}>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-500 shadow" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <EinkDoorDisplay mode={mode} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {DISPLAY_MODES.map((key, i) => (
              <button key={key} onClick={() => setMode(key)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${mode === key ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {t.modes[i]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">{t.previewCaption}</p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id={howId} className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight">{t.howTitle}</h2>
            <p className="mt-3 text-gray-500">{t.howSub}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {t.steps.map(({ n, title, desc }) => (
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
      <section id={featId} className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight">{t.featTitle}</h2>
          <p className="mt-3 text-gray-500">{t.featSub}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.features.map(({ title, desc }, i) => (
            <div key={title} className="group p-6 rounded-2xl border border-gray-100 hover:border-brand-100 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: '#f0edff', color: '#6C47FF' }}>
                {FEATURE_ICONS[i]}
              </div>
              <h3 className="font-bold mb-1.5">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Download ── */}
      <section id={dlId} className="py-24" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #4826dd 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">{t.dlTitle}</h2>
          <p className="mt-3 text-white/70 max-w-md mx-auto">{t.dlDesc}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {DOWNLOADS.map(({ icon, label, sub, href }) => (
              <a key={label} href={href}
                className="group flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all text-left">
                <div className="text-white">{icon}</div>
                <div>
                  <div className="text-white font-bold text-sm">{label}</div>
                  <div className="text-white/60 text-xs">{sub}</div>
                </div>
              </a>
            ))}
          </div>
          <p className="mt-8 text-white/40 text-xs">{t.dlNote}</p>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id={contId} className="py-24 max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{t.contactTitle}</h2>
            <p className="mt-4 text-gray-500 leading-relaxed">{t.contactDesc}</p>
            <ul className="mt-8 space-y-3">
              {t.contactItems.map(item => (
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
            <ContactForm t={t} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span className="font-bold" style={{ color: '#6C47FF' }}>BUMEET</span>
          <span>© {new Date().getFullYear()} Antonio Rodes · {t.footerRights}</span>
          <nav className="flex gap-6">
            <a href={`#${howId}`} className="hover:text-gray-600 transition-colors">{t.nav.howItWorks}</a>
            <a href={`#${contId}`} className="hover:text-gray-600 transition-colors">{t.nav.contact}</a>
            <Link href="/login" className="hover:text-gray-600 transition-colors">{t.nav.signin}</Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
