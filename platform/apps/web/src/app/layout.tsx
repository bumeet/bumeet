import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { CookieBanner } from '@/components/CookieBanner';

// Single, calm typeface across both the corporate site and the dashboard.
// Exposed as a CSS variable so Tailwind's `font-sans` resolves to it.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

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
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
