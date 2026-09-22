import { isVerified, requireSignedIn } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { countPendingApplications } from '@/lib/queries';
import { ROLE_HOME } from '@/lib/format';
import { MobileNav, Nav, type NavItem } from '@/components/Nav';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const profile = await requireSignedIn();
  const home = ROLE_HOME[profile.role];
  const verified = isVerified(profile);

  const items: NavItem[] = [
    { href: home, label: 'Disposition', short: 'Start', icon: '▤' },
    { href: '/network', label: 'Logistik-Netzwerk', short: 'Logistik', icon: '⇄' },
    { href: '/wishlist', label: 'Bedarfsanforderungen', short: 'Bedarf', icon: '☰' },
  ];
  if (profile.role === 'FOODBANK') {
    items.push({ href: '/applications', label: 'Anträge', short: 'Anträge', icon: '✓', badge: await countPendingApplications() });
  }

  return (
    <>
      <header className="bg-slate-900 text-white no-print sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2.5 md:py-3 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-black tracking-wide text-sm whitespace-nowrap">SCHWEIZER TAFEL</span>
            <span className="text-slate-400 text-xs hidden sm:inline">|</span>
            <span className="text-xs font-bold hidden sm:inline">FoodBridge 2.0</span>
          </div>
          {verified && <Nav items={items} />}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] bg-slate-800 border border-slate-700 px-2 py-1 rounded truncate max-w-32 sm:max-w-none">
              {profile.username}<span className="hidden sm:inline"> [{profile.role}]</span>
            </span>
            <form action={logout}>
              <button className="bg-red-700 hover:bg-red-800 text-xs font-bold px-3 py-1.5 rounded min-h-9">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 md:px-4 py-3 md:py-5 pb-20 md:pb-5">
        {children}
      </main>
      <footer className="hidden md:block border-t border-slate-200 bg-slate-50 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
          <span>© 2026 Stiftung Schweizer Tafel — Nationale Plattform für B2B-Lebensmittelrettung</span>
          <span>System: Next.js / Supabase</span>
        </div>
      </footer>
      {verified && <MobileNav items={items} />}
    </>
  );
}

