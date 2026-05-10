import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { CookieBanner } from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: 'BUMEET',
  description: 'Your unified desk presence platform',
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
