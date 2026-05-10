'use client';

import { useState, useEffect } from 'react';

type Consent = 'all' | 'necessary' | null;

const COOKIE_NAME = 'bumeet_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readConsent(): Consent {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return (match ? decodeURIComponent(match[1]) : null) as Consent;
}

function writeConsent(value: 'all' | 'necessary') {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax; Secure`;
}

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (!stored) setVisible(true);
    else setConsent(stored);
  }, []);

  const accept = (value: 'all' | 'necessary') => {
    writeConsent(value);
    setConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-slate-600 flex-1">
          Usamos cookies necesarias para que la app funcione y, con tu permiso, cookies de análisis
          para mejorar el producto.{' '}
          <a href="/privacy" className="text-sky-600 hover:underline font-medium">
            Política de privacidad
          </a>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => accept('necessary')}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Solo necesarias
          </button>
          <button
            onClick={() => accept('all')}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns the stored consent value — use in analytics/tracking code to gate activation. */
export function getConsent(): Consent {
  return readConsent();
}
