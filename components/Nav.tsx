'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartIcon, HomeIcon, LayersIcon, ListIcon, MapIcon, SearchIcon, TruckIcon, UserCheckIcon } from '@/components/icons';

const ICONS = {
  home: HomeIcon, truck: TruckIcon, search: SearchIcon, list: ListIcon, userCheck: UserCheckIcon, layers: LayersIcon, chart: ChartIcon, map: MapIcon,
};

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#b45309] text-white text-xs font-bold">
      {n}<span className="sr-only"> offen</span>
    </span>
  );
}

/** The most specific item wins, so /dispatcher/map highlights "Karte", not "Transporte planen". */
function activeHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter((it) => pathname === it.href || pathname.startsWith(`${it.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Desktop navigation in the header. */
export function Nav({ items }: { items: NavItem[] }) {
  const current = activeHref(usePathname(), items);
  return (
    <nav className="hidden lg:flex flex-1 min-w-0 items-center gap-1">
      {items.map((it) => {
        const active = it.href === current;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-full text-[15px] whitespace-nowrap transition-colors ${active
              ? 'bg-brand-700 text-white font-semibold' : 'text-ink-2 font-medium hover:bg-sand'}`}>
            {it.label}<Count n={it.badge} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Thumb-reachable bottom tab bar on phones. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const current = activeHref(usePathname(), items);
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-line no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const active = it.href === current;
          const Icon = ICONS[it.icon];
          return (
            <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-16 text-[11px] ${active ? 'text-brand-700 font-bold' : 'text-subtle font-medium'}`}>
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-brand-50' : ''}`}><Icon className="size-[22px]" /></span>
              <span>{it.short}</span>
              {Boolean(it.badge) && (
                <span className="absolute top-2 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-[#b45309] text-white text-[11px] font-bold flex items-center justify-center">
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
