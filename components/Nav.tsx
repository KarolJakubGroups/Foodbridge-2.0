'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: string;
  badge?: number;
}

function BadgeDot({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black">{n}</span>;
}

/** Desktop navigation in the header. */
export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href}
          className={`text-xs px-3 py-1.5 rounded ${pathname === it.href ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}>
          {it.label}<BadgeDot n={it.badge} />
        </Link>
      ))}
    </nav>
  );
}

/** Thumb-reachable bottom tab bar on phones. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-900 text-slate-300 border-t border-slate-700 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link key={it.href} href={it.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-bold ${active ? 'text-white bg-slate-800' : ''}`}>
              <span aria-hidden className="text-lg leading-none">{it.icon}</span>
              <span>{it.short}<BadgeDot n={it.badge} /></span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
