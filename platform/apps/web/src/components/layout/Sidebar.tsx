'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Calendar, Link2, MessageSquare, Activity, User, LogOut, Bluetooth, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const nav = [
  { href: '/', label: 'Calendar', icon: Calendar },
  { href: '/integrations', label: 'Integrations', icon: Link2 },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/status', label: 'Status', icon: Activity },
  { href: '/device', label: 'Device', icon: Bluetooth },
  { href: '/account', label: 'Account', icon: User },
];

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-out',
          'md:static md:z-auto md:w-60 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">BUMEET</span>
          </div>
          {/* Close (mobile only) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="md:hidden p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-brand-600 font-medium text-xs">
                {session?.user?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full justify-start gap-2"
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
