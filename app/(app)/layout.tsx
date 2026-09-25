import Link from 'next/link';
import { isVerified, requireSignedIn } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { countPendingApplications } from '@/lib/queries';
import { ROLE_HOME, ROLE_LABEL, initials } from '@/lib/format';
import type { Role } from '@/lib/domain';
import { Logo } from '@/components/Logo';
import { LogOutIcon } from '@/components/icons';
import { MobileNav, Nav, type NavItem } from '@/components/Nav';

/** Each role names its pages after what people do there. */
const NAV: Record<Role, NavItem[]> = {
  DONOR: [
    { href: '/donor', label: 'Übersicht', short: 'Übersicht', icon: 'home' },
    { href: '/network', label: 'Meine Transporte', short: 'Transporte', icon: 'truck' },
    { href: '/wishlist', label: 'Gesuchte Produkte', short: 'Gesucht', icon: 'search' },
  ],
  FOODBANK: [
    { href: '/foodbank', label: 'Lebensmittel finden', short: 'Finden', icon: 'search' },
    { href: '/network', label: 'Meine Lieferungen', short: 'Lieferungen', icon: 'truck' },
    { href: '/wishlist', label: 'Bedarf melden', short: 'Bedarf', icon: 'list' },
    { href: '/applications', label: 'Spender-Anträge', short: 'Anträge', icon: 'userCheck' },
  ],
  DISPATCHER: [
    { href: '/dispatcher', label: 'Transporte planen', short: 'Planen', icon: 'layers' },
    { href: '/network', label: 'Netzwerk & Wirkung', short: 'Netzwerk', icon: 'chart' },
    { href: '/wishlist', label: 'Gesuchte Produkte', short: 'Gesucht', icon: 'list' },
  ],
};

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const profile = await requireSignedIn();
  const verified = isVerified(profile);
  const pendingApplications = profile.role === 'FOODBANK' ? await countPendingApplications() : 0;
  const items = NAV[profile.role].map((it) => (it.href === '/applications' ? { ...it, badge: pendingApplications } : it));

  return (
    <>
      <header className="bg-white border-b border-line no-print sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto h-16 lg:h-[72px] px-4 md:px-8 xl:px-16 flex items-center gap-4 xl:gap-10">
          <Link href={ROLE_HOME[profile.role]} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-700/25">
            <Logo />
          </Link>
          {verified ? <Nav items={items} /> : <div className="flex-1" />}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span title={profile.organizationName} className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f1e7d6] text-[#7a4b12] text-[15px] font-bold">
              {initials(profile.organizationName)}
            </span>
            <div className="hidden md:flex lg:hidden 2xl:flex flex-col leading-tight max-w-52 min-w-0">
              <span className="text-[15px] font-semibold text-ink truncate">{profile.organizationName}</span>
              <span className="text-[13px] text-subtle">{ROLE_LABEL[profile.role]}</span>
            </div>
            <form action={logout}>
              <button className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-control bg-white text-[15px] font-medium text-ink-2 hover:bg-sand"
                aria-label="Abmelden">
                <LogOutIcon className="size-4" /><span className="hidden xl:inline">Abmelden</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-8 xl:px-16 pt-6 md:pt-10 pb-28 lg:pb-12">
        {children}
      </main>
      <footer className="hidden lg:block border-t border-line no-print">
        <div className="max-w-[1440px] mx-auto px-8 xl:px-16 py-4 text-sm text-subtle">
          © 2026 Stiftung Schweizer Tafel
        </div>
      </footer>
      {verified && <MobileNav items={items} />}
    </>
  );
}
