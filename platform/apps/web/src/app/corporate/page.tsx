'use client';

import { useState, createContext, useContext } from 'react';
import {
  Zap, Wifi, ShieldCheck, ArrowRight, Check, ChevronRight,
  Monitor, Bluetooth, Battery, Users, Building2, Gift, Menu, X,
} from 'lucide-react';

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'es';
const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });
const useLang = () => useContext(LangCtx);

const T = {
  en: {
    nav: { howItWorks: 'How it works', forBusiness: 'For Business', download: 'Download', contact: 'Contact', login: 'Log In', demo: 'Request Demo' },
    hero: {
      badge: 'Now available for teams · Free 30-day trial',
      h1a: 'Stop the',
      h1b: 'interruptions.',
      h1c: "Protect your team's focus.",
      sub: 'BUMEET is a wireless e-ink door display that automatically shows when someone is in a meeting — no cables, no apps to open, no action required.',
      cta1: 'Get a Demo for your Team',
      cta2: 'Buy for Myself',
      social: 'Trusted by',
      socialBold: '500+ remote workers',
      socialEnd: 'across Europe',
      detected: 'Auto-detected · 0ms',
      zoomCall: 'Zoom call started',
      battery: 'Battery: 11 months',
      batteryDate: 'Last charged: Jan 2025',
    },
    eink: { available: 'Available', busy: 'Busy', inMeeting: 'In a meeting', ends: 'Ends · 16:00', comeIn: 'Come on in' },
    why: {
      label: 'Why BUMEET',
      h2a: 'Built for deep work.',
      h2b: 'Designed to disappear.',
      sub: 'No dashboards to check, no statuses to update. BUMEET just works.',
      props: [
        { tag: 'Instant Sync', title: 'Detects every call. Automatically.', desc: 'BUMEET listens for camera and microphone activity across Zoom, Teams, Google Meet and Slack — the display updates before your first word.' },
        { tag: 'Zero Wires', title: 'E-ink display. BLE. One-year battery.', desc: 'E-ink only draws power when the content changes. A single charge lasts up to 12 months. No power adapter, no USB cable, no Wi-Fi setup.' },
        { tag: 'Privacy First', title: 'Everything stays on your machine.', desc: "No cloud processing. No cameras. No microphones recording. The agent runs entirely on your computer and communicates directly with the display over Bluetooth." },
      ],
    },
    how: {
      label: 'Setup in minutes',
      h2: 'Three steps to zero interruptions.',
      steps: [
        { title: 'Install the agent', desc: 'Download the lightweight background app for macOS, Windows or Linux. It launches silently at login — no configuration needed.' },
        { title: 'Connect your display', desc: 'Stick the BUMEET screen on your door. Power it on. The agent finds it automatically over Bluetooth Low Energy.' },
        { title: 'Work without interruptions', desc: 'Join any call. The door screen updates in under a second. Your colleagues know instantly — no knocking, no "are you free?" messages.' },
      ],
    },
    download: {
      label: 'Free download',
      h2: 'Download BUMEET Agent',
      sub: 'The background agent runs silently on your computer and updates your door display automatically over Bluetooth.',
      btn: 'Download',
      notes: { mac: 'Right-click → Open on first launch', win: 'Run the .exe directly', linux: 'chmod +x before running' },
      footer: 'Open source · View on GitHub · Latest release: v0.1.0',
    },
    b2b: {
      badge: 'For HR & People Teams',
      h2a: 'The best welcome gift',
      h2b: "you've never thought of.",
      p1a: 'Remote and hybrid workers lose an average of',
      p1b: '2.1 hours per day',
      p1c: 'to unnecessary interruptions. BUMEET is the wellness tool that pays for itself in the first week.',
      p2: 'Include it in your onboarding Welcome Pack. Show your team you take their focus seriously — with your company logo displayed on every screen.',
      features: [
        'Custom logo on idle screen (screensaver mode)',
        'Bulk onboarding — deploy to 100 devices in minutes',
        'Branded Welcome Pack for new hires',
        'Centralized device management dashboard',
        'Volume pricing from 10 units',
        'Dedicated account manager + SLA',
      ],
      cta1: 'Talk to Sales',
      cta2: 'Download Brochure',
      stats: [
        { stat: '500+', label: 'Remote workers protected' },
        { stat: '#1', label: 'Rated onboarding gift in remote-first surveys' },
        { stat: '12mo', label: 'Average battery life per device' },
        { stat: '<1s', label: 'Display update latency' },
      ],
    },
    contact: {
      label: 'Get in touch',
      h2: "Ready to protect your team's focus?",
      sub: 'Request a demo, ask about bulk pricing, or just say hello.',
      name: 'Full Name', namePh: 'Jane Smith',
      email: 'Work Email', emailPh: 'jane@company.com',
      company: 'Company', companyPh: 'Acme Corp (optional)',
      message: 'Message', messagePh: "I'm looking for 50 units for our remote team onboarding...",
      send: 'Send Message', sending: 'Sending…',
      successH: "We'll be in touch shortly.",
      successP: 'Our team typically responds within one business day.',
      or: 'Or email us directly at',
    },
    footer: {
      tagline: 'Protecting focus, one door at a time.',
      rights: 'All rights reserved',
      macNote: 'macOS: right-click → Open on first launch (app not yet notarized)',
      privacy: 'Privacy Policy', terms: 'Terms of Service',
    },
  },
  es: {
    nav: { howItWorks: 'Cómo funciona', forBusiness: 'Para empresas', download: 'Descargar', contact: 'Contacto', login: 'Acceder', demo: 'Solicitar demo' },
    hero: {
      badge: 'Ya disponible para equipos · 30 días gratis',
      h1a: 'Acaba con las',
      h1b: 'interrupciones.',
      h1c: 'Protege el foco de tu equipo.',
      sub: 'BUMEET es una pantalla e-ink inalámbrica para puertas que muestra automáticamente cuándo alguien está en una reunión — sin cables, sin configuración, sin acción necesaria.',
      cta1: 'Solicitar demo para mi equipo',
      cta2: 'Comprar para mí',
      social: 'De confianza para',
      socialBold: '+500 trabajadores remotos',
      socialEnd: 'en Europa',
      detected: 'Detectado automáticamente · 0ms',
      zoomCall: 'Llamada de Zoom iniciada',
      battery: 'Batería: 11 meses',
      batteryDate: 'Última carga: ene 2025',
    },
    eink: { available: 'Disponible', busy: 'Ocupado', inMeeting: 'En reunión', ends: 'Termina · 16:00', comeIn: 'Pasa adelante' },
    why: {
      label: 'Por qué BUMEET',
      h2a: 'Diseñado para el trabajo profundo.',
      h2b: 'Hecho para desaparecer.',
      sub: 'Sin paneles que revisar ni estados que actualizar. BUMEET simplemente funciona.',
      props: [
        { tag: 'Sincronización instantánea', title: 'Detecta cada llamada. Automáticamente.', desc: 'BUMEET monitoriza la cámara y el micrófono en Zoom, Teams, Google Meet y Slack — la pantalla se actualiza antes de que digas una palabra.' },
        { tag: 'Sin cables', title: 'Pantalla e-ink. BLE. Un año de batería.', desc: 'La e-ink solo consume energía cuando cambia el contenido. Una carga dura hasta 12 meses. Sin adaptador, sin cable USB, sin configuración Wi-Fi.' },
        { tag: 'Privacidad total', title: 'Todo permanece en tu equipo.', desc: 'Sin procesamiento en la nube. Sin cámaras. Sin grabación de micrófonos. El agente corre únicamente en tu ordenador y se comunica directamente con la pantalla vía Bluetooth.' },
      ],
    },
    how: {
      label: 'Listo en minutos',
      h2: 'Tres pasos para cero interrupciones.',
      steps: [
        { title: 'Instala el agente', desc: 'Descarga la app ligera en segundo plano para macOS, Windows o Linux. Se lanza silenciosamente al iniciar sesión — sin configuración necesaria.' },
        { title: 'Conecta tu pantalla', desc: 'Pega la pantalla BUMEET en tu puerta. Enciéndela. El agente la encuentra automáticamente vía Bluetooth Low Energy.' },
        { title: 'Trabaja sin interrupciones', desc: 'Únete a cualquier llamada. La pantalla de la puerta se actualiza en menos de un segundo. Tus compañeros lo saben al instante — sin llamadas a la puerta, sin mensajes de "¿estás libre?".' },
      ],
    },
    download: {
      label: 'Descarga gratuita',
      h2: 'Descarga el agente BUMEET',
      sub: 'El agente corre silenciosamente en tu ordenador y actualiza la pantalla de tu puerta automáticamente vía Bluetooth.',
      btn: 'Descargar',
      notes: { mac: 'Clic derecho → Abrir en el primer inicio', win: 'Ejecuta el .exe directamente', linux: 'chmod +x antes de ejecutar' },
      footer: 'Código abierto · Ver en GitHub · Última versión: v0.1.0',
    },
    b2b: {
      badge: 'Para RR.HH. y People Teams',
      h2a: 'El mejor regalo de bienvenida',
      h2b: 'que nunca imaginaste.',
      p1a: 'Los trabajadores remotos e híbridos pierden una media de',
      p1b: '2,1 horas al día',
      p1c: 'por interrupciones innecesarias. BUMEET es la herramienta de bienestar que se amortiza en la primera semana.',
      p2: 'Inclúyelo en tu Welcome Pack de incorporación. Muestra a tu equipo que te tomas en serio su foco — con el logo de tu empresa en cada pantalla.',
      features: [
        'Logo personalizado en pantalla de reposo',
        'Incorporación masiva — despliega 100 dispositivos en minutos',
        'Welcome Pack personalizado para nuevas incorporaciones',
        'Panel de gestión centralizado de dispositivos',
        'Precios por volumen desde 10 unidades',
        'Account manager dedicado + SLA',
      ],
      cta1: 'Hablar con ventas',
      cta2: 'Descargar dossier',
      stats: [
        { stat: '+500', label: 'Trabajadores remotos protegidos' },
        { stat: '#1', label: 'Regalo de incorporación mejor valorado en encuestas remote-first' },
        { stat: '12m', label: 'Vida media de batería por dispositivo' },
        { stat: '<1s', label: 'Latencia de actualización de pantalla' },
      ],
    },
    contact: {
      label: 'Contacta con nosotros',
      h2: '¿Listo para proteger el foco de tu equipo?',
      sub: 'Solicita una demo, pregunta por precios por volumen o simplemente saluda.',
      name: 'Nombre completo', namePh: 'Ana García',
      email: 'Email de trabajo', emailPh: 'ana@empresa.com',
      company: 'Empresa', companyPh: 'Empresa S.L. (opcional)',
      message: 'Mensaje', messagePh: 'Busco 50 unidades para el onboarding de mi equipo remoto...',
      send: 'Enviar mensaje', sending: 'Enviando…',
      successH: 'Nos pondremos en contacto pronto.',
      successP: 'Nuestro equipo responde habitualmente en un día laborable.',
      or: 'O escríbenos directamente a',
    },
    footer: {
      tagline: 'Protegiendo el foco, una puerta a la vez.',
      rights: 'Todos los derechos reservados',
      macNote: 'macOS: clic derecho → Abrir en el primer inicio (app aún no notarizada)',
      privacy: 'Política de privacidad', terms: 'Términos de servicio',
    },
  },
} as const;

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const { lang, setLang } = useLang();
  const t = T[lang].nav;
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-black tracking-tight text-slate-900">BU<span className="text-sky-500">MEET</span></span>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">{t.howItWorks}</a>
          <a href="#for-business" className="hover:text-slate-900 transition-colors">{t.forBusiness}</a>
          <a href="#download" className="hover:text-slate-900 transition-colors">{t.download}</a>
          <a href="#contact" className="hover:text-slate-900 transition-colors">{t.contact}</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 hover:border-sky-300 hover:text-sky-500 transition-colors"
          >
            {lang === 'en' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
          <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">{t.login}</a>
          <a href="#contact" className="px-5 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors shadow-sm shadow-sky-200">{t.demo}</a>
        </div>

        <button className="md:hidden p-2 text-slate-600" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm font-medium text-slate-700">
          <a href="#how-it-works" onClick={() => setOpen(false)}>{t.howItWorks}</a>
          <a href="#for-business" onClick={() => setOpen(false)}>{t.forBusiness}</a>
          <a href="#contact" onClick={() => setOpen(false)}>{t.contact}</a>
          <button onClick={() => { setLang(lang === 'en' ? 'es' : 'en'); setOpen(false); }} className="text-left text-sky-500 font-bold">
            {lang === 'en' ? '🇪🇸 Cambiar a Español' : '🇬🇧 Switch to English'}
          </button>
          <hr className="border-slate-100" />
          <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="text-slate-500">{t.login}</a>
          <a href="#contact" className="px-5 py-2.5 rounded-lg bg-sky-500 text-white font-semibold text-center">{t.demo}</a>
        </div>
      )}
    </header>
  );
}

// ─── E-ink device ─────────────────────────────────────────────────────────────

function EinkDevice() {
  const { lang } = useLang();
  const t = T[lang].eink;
  const [busy, setBusy] = useState(true);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 130, height: 160 }}>
        <div className="absolute inset-0 rounded-xl shadow-xl" style={{ background: 'linear-gradient(160deg,#2d2d2d,#1a1a1a)' }} />
        <div className="absolute rounded-lg" style={{ top: 12, left: 10, right: 10, bottom: 32, background: '#111' }}>
          <div className={`absolute inset-1 rounded-md overflow-hidden flex flex-col ${busy ? 'bg-slate-900' : 'bg-[#e8e4d8]'}`}>
            {busy ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-2">
                <span className="text-[9px] text-slate-400 font-medium tracking-widest uppercase">{t.inMeeting}</span>
                <span className="text-[#e8e4d8] font-black text-lg tracking-wider">{t.busy.toUpperCase()}</span>
                <span className="text-[7px] text-slate-500 mt-1">{t.ends}</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <span className="text-slate-800 font-black text-sm tracking-widest">{t.available.toUpperCase()}</span>
                <span className="text-[7px] text-slate-400 mt-1">{t.comeIn}</span>
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
        <button onClick={() => setBusy(false)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${!busy ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
          {t.available}
        </button>
        <button onClick={() => setBusy(true)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${busy ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
          {t.busy}
        </button>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { lang } = useLang();
  const t = T[lang].hero;

  return (
    <section className="pt-32 pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-600 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            {t.badge}
          </div>

          <h1 className="text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight text-slate-900">
            {t.h1a}{' '}
            <span className="relative">
              <span className="relative z-10 text-sky-500">{t.h1b}</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-sky-100 -z-0 rounded" />
            </span>
            <br />{t.h1c}
          </h1>

          <p className="mt-6 text-xl text-slate-500 leading-relaxed max-w-xl">{t.sub}</p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#contact" className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-all shadow-lg shadow-sky-200 hover:shadow-sky-300">
              {t.cta1}<ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a href="https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-macos.zip" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm hover:border-sky-300 hover:bg-sky-50 transition-all">
              {t.cta2}
            </a>
          </div>

          <div className="mt-10 flex items-center gap-3 text-sm text-slate-400">
            <div className="flex -space-x-2">
              {['#6C47FF','#0EA5E9','#10B981','#F59E0B'].map(c => (
                <div key={c} className="w-7 h-7 rounded-full border-2 border-white" style={{ background: c }} />
              ))}
            </div>
            <span>{t.social} <strong className="text-slate-600">{t.socialBold}</strong> {t.socialEnd}</span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-radial from-sky-100 to-transparent rounded-full blur-3xl opacity-60" />
          <div className="relative">
            <div className="relative rounded-2xl border-8 border-slate-300 bg-gradient-to-b from-amber-50 to-amber-100 shadow-2xl" style={{ width: 260, height: 340 }}>
              <div className="absolute inset-4 rounded-lg border-2 border-amber-200/60" />
              <div className="absolute inset-8 rounded border border-amber-200/40" />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-yellow-400 shadow-md" />
                <div className="w-1 h-6 bg-yellow-300 rounded-full" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 60 }}>
                <EinkDevice />
              </div>
            </div>
            <div className="absolute -right-6 top-8 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />{t.detected}
              </div>
              <div className="text-slate-400 mt-0.5">{t.zoomCall}</div>
            </div>
            <div className="absolute -left-6 bottom-12 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-sky-600 font-bold">
                <Battery size={12} />{t.battery}
              </div>
              <div className="text-slate-400 mt-0.5">{t.batteryDate}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Value Props ──────────────────────────────────────────────────────────────

function ValueProps() {
  const { lang } = useLang();
  const t = T[lang].why;
  const icons = [<Zap size={22} />, <Wifi size={22} />, <ShieldCheck size={22} />];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t.h2a}<br />{t.h2b}</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">{t.sub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {t.props.map(({ tag, title, desc }, i) => (
            <div key={tag} className="group relative p-8 rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-50 transition-all duration-300 bg-white">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center mb-6 group-hover:bg-sky-500 group-hover:text-white transition-colors duration-300">
                {icons[i]}
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

function HowItWorks() {
  const { lang } = useLang();
  const t = T[lang].how;
  const icons = [<Monitor size={20} />, <Bluetooth size={20} />, <ShieldCheck size={20} />];

  return (
    <section id="how-it-works" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t.h2}</h2>
        </div>
        <div className="relative grid md:grid-cols-3 gap-8">
          <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent" />
          {t.steps.map(({ title, desc }, i) => (
            <div key={title} className="relative bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-200 flex-shrink-0">
                  {icons[i]}
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-black flex items-center justify-center">{i + 1}</span>
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

// ─── Download ─────────────────────────────────────────────────────────────────

const DOWNLOAD_ITEMS = [
  {
    os: 'macOS', sub: 'Apple Silicon & Intel · macOS 12+',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-macos.zip',
    noteKey: 'mac' as const,
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" /></svg>,
  },
  {
    os: 'Windows', sub: '64-bit · Windows 10+',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-windows.exe',
    noteKey: 'win' as const,
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>,
  },
  {
    os: 'Linux', sub: 'x86_64 · Ubuntu, Debian, Fedora',
    href: 'https://github.com/bumeet/bumeet/releases/latest/download/bumeet-agent-linux',
    noteKey: 'linux' as const,
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.4-.178-.868-.506-1.335-.322-.384-.927-.977-1.61-1.753-1.293-1.736-1.664-3.967-1.215-5.487.115-.39.295-.756.526-1.076.389-.532.78-1.028.899-1.637.126-.647-.024-1.34-.348-1.942-.324-.6-.789-1.086-1.374-1.432-.585-.347-1.275-.536-1.974-.536z" /></svg>,
  },
];

function DownloadSection() {
  const { lang } = useLang();
  const t = T[lang].download;

  return (
    <section id="download" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t.h2}</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">{t.sub}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {DOWNLOAD_ITEMS.map(({ os, sub, href, noteKey, icon }) => (
            <a key={os} href={href} className="group flex flex-col items-center gap-5 p-8 rounded-2xl border-2 border-slate-100 hover:border-sky-400 hover:shadow-xl hover:shadow-sky-50 transition-all duration-200 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-sky-50 text-slate-500 group-hover:text-sky-500 flex items-center justify-center transition-colors duration-200">{icon}</div>
              <div>
                <div className="text-lg font-black text-slate-900">{os}</div>
                <div className="text-sm text-slate-400 mt-1">{sub}</div>
              </div>
              <div className="mt-auto w-full py-2.5 rounded-xl bg-slate-900 group-hover:bg-sky-500 text-white text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2">
                {t.btn} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-400">{t.notes[noteKey]}</p>
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          {t.footer.split('GitHub').map((part, i) => i === 0
            ? <span key={i}>{part}<a href="https://github.com/bumeet/bumeet" className="text-sky-500 hover:underline" target="_blank" rel="noopener noreferrer">GitHub</a></span>
            : <span key={i}>{part}</span>
          )}
        </p>
      </div>
    </section>
  );
}

// ─── For Business ─────────────────────────────────────────────────────────────

function ForBusiness() {
  const { lang } = useLang();
  const t = T[lang].b2b;
  const statIcons = [<Users size={20} />, <Gift size={20} />, <Battery size={20} />, <Zap size={20} />];

  return (
    <section id="for-business" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl overflow-hidden grid lg:grid-cols-2" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
          <div className="p-12 lg:p-16 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-bold mb-8 w-fit">
              <Building2 size={12} />{t.badge}
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
              {t.h2a}<br /><span className="text-sky-400">{t.h2b}</span>
            </h2>
            <p className="mt-6 text-slate-400 text-lg leading-relaxed">
              {t.p1a} <strong className="text-white">{t.p1b}</strong> {t.p1c}
            </p>
            <p className="mt-4 text-slate-400 leading-relaxed">{t.p2}</p>
            <ul className="mt-8 space-y-3">
              {t.features.map(f => (
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
                {t.cta1}<ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="#contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-sm hover:border-slate-400 hover:text-white transition-colors">
                {t.cta2}
              </a>
            </div>
          </div>
          <div className="p-12 lg:p-16 flex flex-col justify-center gap-8 border-t lg:border-t-0 lg:border-l border-slate-700/50">
            {t.stats.map(({ stat, label }, i) => (
              <div key={stat} className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-slate-700/60 text-sky-400 flex items-center justify-center flex-shrink-0">{statIcons[i]}</div>
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
  const { lang } = useLang();
  const t = T[lang].contact;
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-sm font-bold text-sky-500 tracking-widest uppercase mb-3">{t.label}</p>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{t.h2}</h2>
          <p className="mt-4 text-slate-500 text-lg">{t.sub}</p>
        </div>
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Check size={24} className="text-emerald-500" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-black text-slate-900">{t.successH}</h3>
              <p className="text-slate-500 text-sm">{t.successP}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t.name}</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition" placeholder={t.namePh} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t.email}</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition" placeholder={t.emailPh} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t.company}</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition" placeholder={t.companyPh} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t.message}</label>
                <textarea required rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition resize-none" placeholder={t.messagePh} />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-sky-500 text-white font-bold text-sm hover:bg-sky-600 transition-colors shadow-md shadow-sky-200 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? t.sending : <>{t.send} <ChevronRight size={15} /></>}
              </button>
              <p className="text-center text-xs text-slate-400">
                {t.or}{' '}<a href="mailto:hello@bumeet.es" className="text-sky-500 font-semibold hover:underline">hello@bumeet.es</a>
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
  const { lang } = useLang();
  const t = T[lang].footer;
  const nav = T[lang].nav;

  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-lg font-black text-white">BU<span className="text-sky-500">MEET</span></span>
            <p className="text-xs mt-1">{t.tagline}</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <a href="#how-it-works" className="hover:text-white transition-colors">{nav.howItWorks}</a>
            <a href="#for-business" className="hover:text-white transition-colors">{nav.forBusiness}</a>
            <a href="#contact" className="hover:text-white transition-colors">{nav.contact}</a>
            <a href="https://app.bumeet.es/login" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{nav.login}</a>
          </nav>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} BUMEET · Antonio Rodes · {t.rights}</p>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 flex flex-wrap justify-center gap-6 text-xs text-slate-600">
          <span>{t.privacy}</span>
          <span>{t.terms}</span>
          <span>{t.macNote}</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es');

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
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
    </LangCtx.Provider>
  );
}
