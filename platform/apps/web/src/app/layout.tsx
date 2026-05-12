import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { CookieBanner } from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: 'BUMEET — Pantalla e-ink para puerta que detecta tus reuniones',
  description:
    'BUMEET es una pantalla e-ink inalámbrica para tu puerta que muestra automáticamente si estás disponible o en reunión. Sin cables, sin configuración, 12 meses de batería.',
  openGraph: {
    title: 'BUMEET — Cero interrupciones en el trabajo remoto',
    description:
      'Detecta Zoom, Teams, Slack y calendarios automáticamente. La pantalla de tu puerta se actualiza en menos de un segundo.',
    siteName: 'BUMEET',
    locale: 'es_ES',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
