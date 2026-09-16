import { requireProfile } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { ROLE_HOME } from '@/lib/format';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const profile = await requireProfile();
  return (
    <>
      <header className="bg-slate-900 text-white no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-black tracking-wide text-sm">SCHWEIZER TAFEL</span>
            <span className="text-slate-400 text-xs">|</span>
            <span className="text-xs font-bold">FoodBridge 2.0 B2B Portal</span>
          </div>
          <Nav home={ROLE_HOME[profile.role]} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] bg-slate-800 border border-slate-700 px-2 py-1 rounded">
              {profile.username} [{profile.role}]
            </span>
            <form action={logout}>
              <button className="bg-red-700 hover:bg-red-800 text-xs font-bold px-3 py-1 rounded">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
          <span>© 2026 Stiftung Schweizer Tafel — Nationale Plattform für B2B-Lebensmittelrettung</span>
          <span>System: Next.js / Supabase</span>
        </div>
      </footer>
    </>
  );
}
