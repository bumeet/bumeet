'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

/**
 * Responsive dashboard frame: a static sidebar on md+ screens, and a slide-in
 * drawer behind a top-bar hamburger on mobile. Holds the drawer open state so
 * the server layout can stay a thin auth gate.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card md:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setOpen(true)}
            className="-ml-2 p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <span className="flex items-center gap-2 font-bold text-gray-900">
            <span className="w-6 h-6 bg-brand-500 rounded-md flex items-center justify-center text-white text-xs font-bold">
              B
            </span>
            BUMEET
          </span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
