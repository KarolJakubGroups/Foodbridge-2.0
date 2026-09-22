'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = (home: string) => [
  { href: home, label: 'Disposition', short: 'Start', icon: '▤' },
  { href: '/network', label: 'Logistik-Netzwerk', short: 'Logistik', icon: '⇄' },
  { href: '/wishlist', label: 'Bedarfsanforderungen', short: 'Bedarf', icon: '☰' },
];

/** Desktop navigation in the header. */
export function Nav({ home }: { home: string }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1">
      {items(home).map((it) => (
        <Link key={it.href} href={it.href}
          className={`text-xs px-3 py-1.5 rounded ${pathname === it.href ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Thumb-reachable bottom tab bar on phones. */
export function MobileNav({ home }: { home: string }) {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900 text-slate-300 border-t border-slate-700 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-3">
        {items(home).map((it) => {
          const active = pathname === it.href;
          return (
            <Link key={it.href} href={it.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-bold ${active ? 'text-white bg-slate-800' : ''}`}>
              <span aria-hidden className="text-lg leading-none">{it.icon}</span>
              {it.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
