'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav({ home }: { home: string }) {
  const pathname = usePathname();
  const items = [
    { href: home, label: 'Disposition' },
    { href: '/network', label: 'Logistik-Netzwerk' },
    { href: '/wishlist', label: 'Bedarfsanforderungen' },
  ];
  return (
    <nav className="flex items-center gap-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href}
          className={`text-xs px-3 py-1.5 rounded ${pathname === it.href ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
