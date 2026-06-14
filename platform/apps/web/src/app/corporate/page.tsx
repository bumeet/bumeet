'use client';

import { useState, createContext, useContext } from 'react';
import {
  Zap, Wifi, ShieldCheck, ArrowRight, Check,
  Monitor, Bluetooth, Battery, Users, Building2, Menu, X,
} from 'lucide-react';

// ── i18n ──────────────────────────────────────────────────────────────────────
type Lang = 'en' | 'es';
const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'es',
  setLang: () => {},
});
const useLang = () => useContext(LangCtx);

const RELEASES = 'https://stbumeetreleases.blob.core.windows.net/releases/latest';

// ── Copy ──────────────────────────────────────────────────────────────────────
const T = {
  en: {
    nav: {
      howItWorks: 'How it works',
      forBusiness: 'For Business',
      download: 'Download',
      contact: 'Contact',
      login: 'Log in',
      demo: 'Get a demo',
    },
    hero: {
      badge: 'Bluetooth · No cables · 12-month battery',
      h1a: 'Stop the',
      h1b: 'interruptions.',
      h1c: "Protect your team's focus.",
      sub: 'A wireless e-ink display for your door that detects Zoom, Teams, Slack and calendar events — automatically. No cables, no apps, no action required.',
      cta1: 'Get a demo for your team',
      cta2: 'Download the agent',
      social: 'Built for remote-first teams across Europe',
      detected: 'Auto-detected · <1 s',
      zoomCall: 'Zoom call in progress',
      battery: '12-month battery',
      batteryDate: 'Last charged: Jan 2025',
    },
    integrations: { label: 'Works automatically with your entire stack' },
    eink: {
      available: 'Available',
      busy: 'Busy',
      inMeeting: 'In a meeting',
      ends: 'Ends · 16:00',
      comeIn: 'Come on in',
    },
    why: {
      label: 'Why BUMEET',
      h2a: 'Built for deep work.',
      h2b: 'Designed to disappear.',
      sub: 'No dashboards to check, no manual updates. BUMEET detects your calls and updates the display automatically.',
      props: [
        {
          tag: 'Instant sync',
          title: 'Detects every call. Automatically.',
          desc: 'BUMEET monitors camera and microphone activity across Zoom, Teams, Google Meet and Slack. The display updates in under a second — before you say a word.',
        },
        {
          tag: 'Zero wires',
          title: 'E-ink. Bluetooth. One-year battery.',
          desc: 'E-ink only draws power when the content changes. A single charge lasts up to 12 months. No power adapter, no USB cable, no Wi-Fi setup required.',
        },
        {
          tag: 'Privacy first',
          title: 'Your camera is never recorded.',
          desc: 'Only presence status (free / busy) is synced — encrypted in transit. You choose which integrations to authorise and can pause the agent at any time.',
        },
      ],
    },
    how: {
      label: 'Setup in minutes',
      h2: 'Three steps to zero interruptions.',
      steps: [
        {
          title: 'Install the agent',
          desc: 'Download the lightweight background app for macOS, Windows or Linux. It launches silently at login — no configuration needed.',
        },
        {
          title: 'Connect your display',
          desc: 'Stick the BUMEET screen on your door, power it on. The agent finds it automatically over Bluetooth Low Energy.',
        },
        {
          title: 'Work without interruptions',
          desc: 'Join any call — the door display updates in under a second. Your colleagues know instantly. No knocking, no "are you free?" messages.',
        },
      ],
    },
    download: {
      label: 'Free download',
      h2: 'Get the BUMEET agent',
      sub: 'The background agent runs silently on your computer and keeps your door display in sync over Bluetooth.',
      btn: 'Download',
      notes: {
        mac: 'Right-click the PKG → Open if Gatekeeper blocks it',
        win: 'Run the .exe directly — no installation needed',
        linux: 'Run chmod +x before executing',
      },
      github: 'View source on GitHub',
    },
    b2b: {
      badge: 'For HR & People teams',
      h2a: 'The best welcome gift',
      h2b: "you've never thought of.",
      p1: 'Remote and hybrid workers lose an average of 2.1 hours per day to unnecessary interruptions. BUMEET is the focus tool that pays for itself in the first week.',
      p2: 'Include it in your onboarding Welcome Pack. Show your team you take their focus seriously — with your brand displayed on every idle screen.',
      features: [
        'Custom company logo on idle screen',
        'Bulk onboarding — deploy 100 devices in minutes',
        'Branded Welcome Pack for new hires',
        'Centralised device management dashboard',
        'Volume pricing from 10 units',
        'Dedicated account manager + SLA',
      ],
      cta1: 'Talk to sales',
      cta2: 'Download brochure',
      stats: [
        { stat: '< 1 s', label: 'Display update latency' },
        { stat: '12 mo', label: 'Battery life per device' },
        { stat: '100%', label: 'Wireless — no cables needed' },
        { stat: '0', label: 'Configuration steps required' },
      ],
    },
    contact: {
      label: 'Get in touch',
      h2: "Ready to protect your team's focus?",
      sub: 'Request a demo, ask about bulk pricing, or just say hello.',
      name: 'Full name',
      namePh: 'Jane Smith',
      email: 'Work email',
      emailPh: 'jane@company.com',
      company: 'Company',
      companyPh: 'Acme Corp (optional)',
      message: 'Message',
      messagePh: "I'm looking for 50 units for our remote team onboarding…",
      send: 'Send message',
      sending: 'Sending…',
      successH: "We'll be in touch shortly.",
      successP: 'Our team typically responds within one business day.',
      or: 'Or email us directly at',
      errorH: "Couldn't send your message",
      errorP: 'Please try again, or email us directly.',
    },
    footer: {
      tagline: 'Protecting focus, one door at a time.',
      rights: 'All rights reserved.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
  },
  es: {
    nav: {
      howItWorks: 'Cómo funciona',
      forBusiness: 'Para empresas',
      download: 'Descargar',
      contact: 'Contacto',
      login: 'Acceder',
      demo: 'Pedir una demo',
    },
    hero: {
      badge: 'Bluetooth · Sin cables · 12 meses de batería',
      h1a: 'Acaba con las',
      h1b: 'interrupciones.',
      h1c: 'Protege la concentración de tu equipo.',
      sub: 'Una pantalla inalámbrica para tu puerta que detecta tus llamadas de Zoom, Teams, Slack y tu calendario de forma automática. Sin cables, sin apps y sin que tengas que hacer nada.',
      cta1: 'Pedir una demo para mi equipo',
      cta2: 'Descargar el agente',
      social: 'Pensado para equipos en remoto de toda Europa',
      detected: 'Detección automática · menos de 1 s',
      zoomCall: 'Llamada de Zoom en curso',
      battery: '12 meses de batería',
      batteryDate: 'Última carga: ene 2025',
    },
    integrations: { label: 'Funciona automáticamente con todas tus herramientas' },
    eink: {
      available: 'Disponible',
      busy: 'Ocupado',
      inMeeting: 'En una reunión',
      ends: 'Acaba · 16:00',
      comeIn: 'Puedes pasar',
    },
    why: {
      label: 'Por qué BUMEET',
      h2a: 'Hecho para trabajar concentrado.',
      h2b: 'Diseñado para pasar desapercibido.',
      sub: 'No hay paneles que mirar ni estados que cambiar a mano. BUMEET detecta tus llamadas y actualiza la pantalla por ti.',
      props: [
        {
          tag: 'Al instante',
          title: 'Detecta cada llamada. Sin que hagas nada.',
          desc: 'BUMEET nota cuándo usas la cámara o el micrófono en Zoom, Teams, Google Meet o Slack. La pantalla cambia en menos de un segundo.',
        },
        {
          tag: 'Sin cables',
          title: 'Tinta electrónica. Bluetooth. Un año de batería.',
          desc: 'La tinta electrónica (e-ink) solo gasta batería cuando cambia lo que muestra. Una carga dura hasta 12 meses. Sin enchufe, sin cable USB y sin configurar wifi.',
        },
        {
          tag: 'Privacidad',
          title: 'Tu cámara nunca se graba.',
          desc: 'Solo se comparte si estás libre u ocupado, y viaja cifrado. Tú eliges qué conectas y puedes pausar el agente cuando quieras.',
        },
      ],
    },
    how: {
      label: 'Listo en minutos',
      h2: 'Tres pasos y se acabaron las interrupciones.',
      steps: [
        {
          title: 'Instala el agente',
          desc: 'Descarga la pequeña app para macOS, Windows o Linux. Se abre sola al encender el ordenador, sin configurar nada.',
        },
        {
          title: 'Conecta la pantalla',
          desc: 'Pega la pantalla BUMEET en tu puerta y enciéndela. El agente la encuentra solo por Bluetooth.',
        },
        {
          title: 'Trabaja tranquilo',
          desc: 'Entra en cualquier llamada y la pantalla de la puerta cambia en menos de un segundo. Tus compañeros lo ven al momento: sin llamar a la puerta ni preguntar "¿tienes un momento?".',
        },
      ],
    },
    download: {
      label: 'Descarga gratis',
      h2: 'Descarga el agente de BUMEET',
      sub: 'El agente funciona en segundo plano en tu ordenador y mantiene al día la pantalla de tu puerta por Bluetooth.',
      btn: 'Descargar',
      notes: {
        mac: 'Si Gatekeeper lo bloquea: clic derecho en el PKG → Abrir',
        win: 'Ejecuta el .exe directamente, no hay que instalar nada',
        linux: 'Dale permisos con chmod +x antes de ejecutarlo',
      },
      github: 'Ver el código en GitHub',
    },
    b2b: {
      badge: 'Para Recursos Humanos',
      h2a: 'El mejor regalo de bienvenida',
      h2b: 'que aún no se te había ocurrido.',
      p1: 'Quien trabaja en remoto o en híbrido pierde de media 2,1 horas al día por interrupciones que se pueden evitar. BUMEET se paga solo en la primera semana.',
      p2: 'Inclúyelo en el kit de bienvenida de los nuevos empleados. Demuestra a tu equipo que cuidas su concentración, con el logo de tu empresa en cada pantalla en reposo.',
      features: [
        'El logo de tu empresa en la pantalla en reposo',
        'Configura 100 dispositivos en minutos',
        'Kit de bienvenida personalizado para nuevos empleados',
        'Un único panel para gestionar todos los dispositivos',
        'Precio por volumen desde 10 unidades',
        'Gestor de cuenta dedicado y soporte garantizado',
      ],
      cta1: 'Hablar con ventas',
      cta2: 'Descargar el folleto',
      stats: [
        { stat: '< 1 s', label: 'En actualizar la pantalla' },
        { stat: '12 meses', label: 'De batería por dispositivo' },
        { stat: '100%', label: 'Sin cables' },
        { stat: '0', label: 'Pasos de configuración' },
      ],
    },
    contact: {
      label: 'Hablemos',
      h2: '¿Quieres que tu equipo trabaje sin interrupciones?',
      sub: 'Pide una demo, pregunta por el precio por volumen o solo salúdanos.',
      name: 'Nombre completo',
      namePh: 'Ana García',
      email: 'Email de trabajo',
      emailPh: 'ana@empresa.com',
      company: 'Empresa',
      companyPh: 'Empresa S.L. (opcional)',
      message: 'Mensaje',
      messagePh: 'Quiero 50 unidades para dar la bienvenida a mi equipo en remoto…',
      send: 'Enviar mensaje',
      sending: 'Enviando…',
      successH: 'Te escribimos enseguida.',
      successP: 'Solemos responder en un día laborable.',
      or: 'O escríbenos directamente a',
      errorH: 'No se pudo enviar',
      errorP: 'Inténtalo otra vez o escríbenos por email.',
    },
    footer: {
      tagline: 'Cuidamos tu concentración, puerta a puerta.',
      rights: 'Todos los derechos reservados.',
      privacy: 'Política de privacidad',
      terms: 'Términos de servicio',
    },
  },
} as const;

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const { lang, setLang } = useLang();
  const t = T[lang].nav;
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight text-slate-900">
          BU<span className="text-brand-500">MEET</span>
        </span>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">{t.howItWorks}</a>
          <a href="#for-business" className="hover:text-slate-900 transition-colors">{t.forBusiness}</a>
          <a href="#download" className="hover:text-slate-900 transition-colors">{t.download}</a>
          <a href="#contact" className="hover:text-slate-900 transition-colors">{t.contact}</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:border-brand-300 hover:text-brand-500 transition-colors"
          >
            {lang === 'en' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
          <a
            href="https://app.bumeet.es/login"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            {t.login}
          </a>
          <a
            href="#contact"
            className="px-5 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            {t.demo}
          </a>
        </div>

        <button className="md:hidden p-2 text-slate-600" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm font-medium text-slate-700">
          <a href="#how-it-works" onClick={() => setOpen(false)}>{t.howItWorks}</a>
          <a href="#for-business" onClick={() => setOpen(false)}>{t.forBusiness}</a>
          <a href="#download" onClick={() => setOpen(false)}>{t.download}</a>
          <a href="#contact" onClick={() => setOpen(false)}>{t.contact}</a>
          <button
            onClick={() => { setLang(lang === 'en' ? 'es' : 'en'); setOpen(false); }}
            className="text-left text-brand-500 font-bold"
          >
            {lang === 'en' ? '🇪🇸 Cambiar a Español' : '🇬🇧 Switch to English'}
          </button>
          <hr className="border-slate-100" />
          <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="text-slate-500">{t.login}</a>
          <a href="#contact" onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-center">{t.demo}</a>
        </div>
      )}
    </header>
  );
}

// ── E-ink device mockup ───────────────────────────────────────────────────────
function EinkDevice() {
  const { lang } = useLang();
  const t = T[lang].eink;
  const [busy, setBusy] = useState(true);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Device frame */}
      <div className="relative" style={{ width: 148, height: 180 }}>
        {/* Outer casing */}
        <div
          className="absolute inset-0 rounded-2xl shadow-xl"
          style={{ background: 'linear-gradient(160deg, #2a2a2a 0%, #171717 100%)' }}
        />
        {/* Screen bezel */}
        <div
          className="absolute rounded-xl"
          style={{ top: 14, left: 12, right: 12, bottom: 36, background: '#0d0d0d' }}
        >
          {/* E-ink display area */}
          <div
            className={`absolute inset-1.5 rounded-lg overflow-hidden flex flex-col transition-colors duration-700 ${
              busy ? 'bg-slate-900' : 'bg-[#e8e4d8]'
            }`}
          >
            {busy ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2">
                <span className="text-[8px] text-slate-500 font-semibold tracking-[0.2em] uppercase">{t.inMeeting}</span>
                <span className="text-[#e8e4d8] font-bold text-xl tracking-widest">{t.busy.toUpperCase()}</span>
                <div className="w-8 h-px bg-slate-700 my-0.5" />
                <span className="text-[7px] text-slate-500">{t.ends}</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                <span className="text-slate-800 font-bold text-sm tracking-[0.25em]">{t.available.toUpperCase()}</span>
                <span className="text-[7px] text-slate-500 tracking-wider">{t.comeIn}</span>
              </div>
            )}
          </div>
        </div>
        {/* Status LED */}
        <div
          className={`absolute rounded-full w-2 h-2 transition-colors duration-700 ${
            busy ? 'bg-red-400' : 'bg-emerald-400'
          }`}
          style={{ top: 8, left: '50%', transform: 'translateX(-50%)' }}
        />
        {/* Side buttons */}
        {[24, 42, 60].map((top) => (
          <div key={top} className="absolute right-1 w-1.5 h-5 rounded-full bg-slate-700" style={{ top }} />
        ))}
        {/* Logo */}
        <div className="absolute bottom-2.5 left-0 right-0 text-center">
          <span className="text-slate-600 font-bold" style={{ fontSize: 6, letterSpacing: 3 }}>BUMEET</span>
        </div>
      </div>

      {/* State toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setBusy(false)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            !busy ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {t.available}
        </button>
        <button
          onClick={() => setBusy(true)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            busy ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {t.busy}
        </button>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  const { lang } = useLang();
  const t = T[lang].hero;

  return (
    <section className="pt-32 pb-24" style={{ background: 'linear-gradient(160deg, #f5f3ff 0%, #ffffff 55%)' }}>
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: copy */}
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-500 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            {t.badge}
          </div>

          <h1 className="text-5xl lg:text-[3.75rem] font-bold leading-[1.06] tracking-tight text-slate-900">
            {t.h1a}{' '}
            <span className="relative inline-block">
              <span className="relative z-10 text-brand-500">{t.h1b}</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-brand-50 -z-0 rounded" />
            </span>
            <br />{t.h1c}
          </h1>

          <p className="mt-6 text-lg text-slate-500 leading-relaxed max-w-lg">{t.sub}</p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-all shadow-sm"
            >
              {t.cta1}
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#download"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 transition-all"
            >
              {t.cta2}
            </a>
          </div>

          <p className="mt-10 text-sm text-slate-400 font-medium">{t.social}</p>
        </div>

        {/* Right: device visual */}
        <div className="relative flex items-center justify-center">
          {/* Glow behind device */}
          <div
            className="absolute rounded-full blur-3xl opacity-30"
            style={{
              width: 320,
              height: 320,
              background: 'radial-gradient(circle, #6C47FF 0%, transparent 70%)',
            }}
          />

          <div className="relative">
            {/* Door frame */}
            <div
              className="relative rounded-2xl border-8 border-slate-200 shadow-xl"
              style={{
                width: 280,
                height: 360,
                background: 'linear-gradient(180deg, #f8f6f0 0%, #ede9df 100%)',
              }}
            >
              {/* Door panels */}
              <div className="absolute inset-5 rounded-lg border border-amber-200/70" />
              <div className="absolute inset-9 rounded border border-amber-200/40" />
              {/* Door handle */}
              <div className="absolute right-7 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-yellow-400 shadow" />
                <div className="w-1 h-7 bg-yellow-300 rounded-full" />
              </div>
              {/* Device on door */}
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 64 }}>
                <EinkDevice />
              </div>
            </div>

            {/* Callout: auto-detected */}
            <div className="absolute -right-8 top-6 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs min-w-[140px]">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t.detected}
              </div>
              <div className="text-slate-400 mt-0.5">{t.zoomCall}</div>
            </div>

            {/* Callout: battery */}
            <div className="absolute -left-8 bottom-14 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs min-w-[140px]">
              <div className="flex items-center gap-2 text-brand-500 font-bold">
                <Battery size={13} />
                {t.battery}
              </div>
              <div className="text-slate-400 mt-0.5">{t.batteryDate}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Integration strip ─────────────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    name: 'Zoom',
    color: '#2D8CFF',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15.998 6.5H4.002A2.003 2.003 0 002 8.502v6.996A2.003 2.003 0 004.002 17.5h11.996A2.003 2.003 0 0018 15.498V8.502A2.003 2.003 0 0015.998 6.5zm5.87.9l-3.868 2.736v3.728l3.867 2.736A.5.5 0 0022.5 16V7.8a.5.5 0 00-.632-.4z" />
      </svg>
    ),
  },
  {
    name: 'Microsoft Teams',
    color: '#6264A7',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M20.625 5.813A2.812 2.812 0 1017.813 3a2.812 2.812 0 002.812 2.813zM14.4 6.75h6.85A1.75 1.75 0 0123 8.5v5.75a4.25 4.25 0 01-4.25 4.25h-.1A4.25 4.25 0 0114.4 14.25V7.5a.75.75 0 01.75-.75H14.4zM9 6a3 3 0 100-6 3 3 0 000 6zM2.25 8.25A2.25 2.25 0 014.5 6h9a2.25 2.25 0 012.25 2.25v6.375A5.625 5.625 0 019 20.25 5.625 5.625 0 013.375 14.625V9H2.25z" />
      </svg>
    ),
  },
  {
    name: 'Slack',
    color: '#4A154B',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
  {
    name: 'Google Meet',
    color: '#00897B',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.41 19.1C5.12 19.56 12 19.56 12 19.56s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95 29 29 0 00.46-5.33 29 29 0 00-.46-5.34z" />
        <polygon fill="#fff" points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    ),
  },
  {
    name: 'Google Calendar',
    color: '#4285F4',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V9h14v10zm0-12H5V5h14v2z" />
      </svg>
    ),
  },
  {
    name: 'Webex',
    color: '#00BCEB',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.89 7.43a.75.75 0 01-.697.472h-3.95a.75.75 0 01-.697-.472l-2.89-7.43a.75.75 0 01.697-1.028h9.73a.75.75 0 01.697 1.028z" />
      </svg>
    ),
  },
];

function IntegrationStrip() {
  const { lang } = useLang();
  const t = T[lang].integrations;

  return (
    <section className="py-14 bg-white border-y border-slate-100">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs font-bold text-slate-400 tracking-widest uppercase mb-8">
          {t.label}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {INTEGRATIONS.map(({ name, color, icon }) => (
            <div
              key={name}
              className="flex items-center gap-2.5 text-slate-400 hover:text-slate-700 transition-colors duration-200 group"
            >
              <span className="opacity-50 group-hover:opacity-100 transition-opacity" style={{ color }}>
                {icon}
              </span>
              <span className="text-sm font-semibold">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Value Props ───────────────────────────────────────────────────────────────
function ValueProps() {
  const { lang } = useLang();
  const t = T[lang].why;
  const icons = [<Zap size={22} key="zap" />, <Wifi size={22} key="wifi" />, <ShieldCheck size={22} key="shield" />];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-brand-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
            {t.h2a}<br />{t.h2b}
          </h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">{t.sub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {t.props.map(({ tag, title, desc }, i) => (
            <div
              key={tag}
              className="group relative p-8 rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-lg transition-all duration-300 bg-white"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center mb-6 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                {icons[i]}
              </div>
              <p className="text-xs font-bold text-brand-500 tracking-widest uppercase mb-2">{tag}</p>
              <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const { lang } = useLang();
  const t = T[lang].how;
  const icons = [
    <Monitor size={20} key="monitor" />,
    <Bluetooth size={20} key="bluetooth" />,
    <ShieldCheck size={20} key="shield" />,
  ];

  return (
    <section id="how-it-works" className="scroll-mt-20 py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-brand-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{t.h2}</h2>
        </div>
        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
          {t.steps.map(({ title, desc }, i) => (
            <div key={title} className="relative bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-5">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                    {icons[i]}
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 pt-2">{title}</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Download ──────────────────────────────────────────────────────────────────
const DOWNLOAD_ITEMS = [
  {
    os: 'macOS',
    sub: 'Apple Silicon & Intel · macOS 13+',
    href: `${RELEASES}/bumeet-agent.dmg`,
    noteKey: 'mac' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" />
      </svg>
    ),
  },
  {
    os: 'Windows',
    sub: '64-bit · Windows 10+',
    href: `${RELEASES}/bumeet-agent-windows.exe`,
    noteKey: 'win' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
  },
  {
    os: 'Linux',
    sub: 'x86_64 · Ubuntu, Debian, Fedora',
    href: `${RELEASES}/bumeet-agent-linux`,
    noteKey: 'linux' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.4-.178-.868-.506-1.335-.322-.384-.927-.977-1.61-1.753-1.293-1.736-1.664-3.967-1.215-5.487.115-.39.295-.756.526-1.076.389-.532.78-1.028.899-1.637.126-.647-.024-1.34-.348-1.942-.324-.6-.789-1.086-1.374-1.432-.585-.347-1.275-.536-1.974-.536z" />
      </svg>
    ),
  },
];

function DownloadSection() {
  const { lang } = useLang();
  const t = T[lang].download;

  return (
    <section id="download" className="scroll-mt-20 py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-brand-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{t.h2}</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">{t.sub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {DOWNLOAD_ITEMS.map(({ os, sub, href, noteKey, icon }) => (
            <a
              key={os}
              href={href}
              className="group flex flex-col items-center gap-5 p-8 rounded-2xl border border-slate-100 hover:border-brand-400 hover:shadow-lg transition-all duration-200 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-brand-50 text-slate-400 group-hover:text-brand-500 flex items-center justify-center transition-colors duration-200">
                {icon}
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900">{os}</div>
                <div className="text-sm text-slate-400 mt-1">{sub}</div>
              </div>
              <div className="mt-auto w-full py-2.5 rounded-xl bg-slate-900 group-hover:bg-brand-500 text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2">
                {t.btn}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-400">{t.notes[noteKey]}</p>
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          <a
            href="https://github.com/bumeet/bumeet"
            className="text-brand-500 hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.github}
          </a>
        </p>
      </div>
    </section>
  );
}

// ── For Business ──────────────────────────────────────────────────────────────
function ForBusiness() {
  const { lang } = useLang();
  const t = T[lang].b2b;
  const statIcons = [
    <Zap size={20} key="zap" />,
    <Battery size={20} key="battery" />,
    <Wifi size={20} key="wifi" />,
    <Users size={20} key="users" />,
  ];

  return (
    <section id="for-business" className="scroll-mt-20 py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="rounded-3xl overflow-hidden grid lg:grid-cols-2"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}
        >
          {/* Left: copy */}
          <div className="p-12 lg:p-16 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold mb-8 w-fit">
              <Building2 size={12} />{t.badge}
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight leading-tight">
              {t.h2a}<br />
              <span className="text-brand-400">{t.h2b}</span>
            </h2>
            <p className="mt-6 text-slate-400 leading-relaxed">{t.p1}</p>
            <p className="mt-3 text-slate-400 leading-relaxed">{t.p2}</p>
            <ul className="mt-8 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center flex-shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#contact"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-400 transition-colors shadow-sm"
              >
                {t.cta1}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-sm hover:border-slate-400 hover:text-white transition-colors"
              >
                {t.cta2}
              </a>
            </div>
          </div>

          {/* Right: stats */}
          <div className="p-12 lg:p-16 flex flex-col justify-center gap-8 border-t lg:border-t-0 lg:border-l border-slate-700/50">
            {t.stats.map(({ stat, label }, i) => (
              <div key={stat} className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-slate-700/60 text-brand-400 flex items-center justify-center flex-shrink-0">
                  {statIcons[i]}
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">{stat}</div>
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

// ── Contact ───────────────────────────────────────────────────────────────────
function Contact() {
  const { lang } = useLang();
  const t = T[lang].contact;
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // Don't claim success if the request actually failed.
      if (!res.ok) throw new Error('request failed');
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition';
  const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <section id="contact" className="scroll-mt-20 py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-bold text-brand-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{t.h2}</h2>
          <p className="mt-4 text-slate-500 text-lg">{t.sub}</p>
        </div>
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Check size={24} className="text-emerald-500" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t.successH}</h3>
              <p className="text-slate-500 text-sm">{t.successP}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{t.name}</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder={t.namePh}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t.email}</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                    placeholder={t.emailPh}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t.company}</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className={inputClass}
                  placeholder={t.companyPh}
                />
              </div>
              <div>
                <label className={labelClass}>{t.message}</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  placeholder={t.messagePh}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-brand-500 text-white font-bold text-sm hover:bg-brand-600 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? t.sending : t.send}
              </button>
              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-600" role="alert">
                  <X size={14} /> {t.errorP}
                </div>
              )}
              <p className="text-center text-xs text-slate-400">
                {t.or}{' '}
                <a href="mailto:hello@bumeet.es" className="text-brand-500 font-semibold hover:underline">
                  hello@bumeet.es
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const { lang } = useLang();
  const t = T[lang].footer;
  const nav = T[lang].nav;

  return (
    <footer className="bg-slate-900 text-slate-400 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-slate-800">
          <div>
            <span className="text-xl font-bold text-white">
              BU<span className="text-brand-400">MEET</span>
            </span>
            <p className="text-xs mt-1.5 text-slate-500">{t.tagline}</p>
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#how-it-works" className="hover:text-white transition-colors">{nav.howItWorks}</a>
            <a href="#for-business" className="hover:text-white transition-colors">{nav.forBusiness}</a>
            <a href="#download" className="hover:text-white transition-colors">{nav.download}</a>
            <a href="#contact" className="hover:text-white transition-colors">{nav.contact}</a>
            <a
              href="https://app.bumeet.es/login"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {nav.login}
            </a>
          </nav>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} BUMEET · {t.rights}</p>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-slate-400 transition-colors">{t.privacy}</a>
            <a href="/terms" className="hover:text-slate-400 transition-colors">{t.terms}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es');

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <div className="min-h-screen bg-white text-slate-900 antialiased">
        <Nav />
        <Hero />
        <IntegrationStrip />
        <ValueProps />
        <HowItWorks />
        <DownloadSection />
        <ForBusiness />
        <Contact />
        <Footer />
      </div>
    </LangCtx.Provider>
  );
}
