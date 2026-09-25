import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { countUnbundledClaimed, fetchTransportOrders } from '@/lib/queries';
import { fmtCount } from '@/lib/format';
import { PageHeader, TONE, linkCls } from '@/components/ui';
import { LayersIcon } from '@/components/icons';
import { BundleButton } from '@/components/BundleButton';
import { OrderCard, OrderSummary } from '@/components/OrderCard';

export const dynamic = 'force-dynamic';

const RECENT_DELIVERED = 6;

function Column({ dot, title, count, children, empty }: { dot: string; title: string; count: number; children: ReactNode; empty: string }) {
  return (
    <section className="flex flex-col gap-3.5 min-w-0">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={`size-3 rounded-full ${dot}`} />
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <span className="text-base text-muted">{count}</span>
      </div>
      {count === 0 ? <p className="rounded-2xl border border-dashed border-control px-5 py-8 text-center text-[15px] text-muted">{empty}</p> : children}
    </section>
  );
}

export default async function DispatcherPage() {
  await requireRole('DISPATCHER');
  const [orders, waiting] = await Promise.all([fetchTransportOrders(), countUnbundledClaimed()]);
  const now = new Date().toISOString();
  const pending = orders.filter((o) => o.status === 'PENDING');
  const underway = orders.filter((o) => o.status === 'DISPATCHED');
  const delivered = orders.filter((o) => o.status === 'COMPLETED').reverse();

  return (
    <div className="space-y-8">
      <PageHeader title="Transporte planen" subtitle="Reservierte Spenden zu Abholfahrten zusammenfassen und den Stand verfolgen." />

      <section className="bg-white border border-line rounded-2xl p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
        <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${TONE.green}`}><LayersIcon className="size-7" /></span>
        <div className="flex-1 space-y-1.5">
          <p className="text-xl md:text-[22px] font-bold text-ink">
            {waiting === 0 ? 'Keine Spenden warten auf einen Transport'
              : `${fmtCount(waiting, 'reservierte Spende wartet', 'reservierte Spenden warten')} auf einen Transport`}
          </p>
          <p className="text-base leading-relaxed text-muted max-w-3xl">
            Spenden vom gleichen Spender mit passenden Abholzeiten werden zu einer Fahrt zusammengefasst.
            Sie sehen den Vorschlag und können ihn anpassen, bevor Aufträge entstehen.
          </p>
        </div>
        <BundleButton disabled={waiting === 0} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Column dot="bg-[#6d28d9]" title="Zu disponieren" count={pending.length} empty="Keine offenen Aufträge.">
          {pending.map((o) => <OrderCard key={o.id} order={o} now={now} />)}
        </Column>
        <Column dot="bg-[#d97706]" title="Unterwegs" count={underway.length} empty="Gerade ist keine Fahrt unterwegs.">
          {underway.map((o) => <OrderCard key={o.id} order={o} now={now} />)}
        </Column>
        <Column dot="bg-[#667085]" title="Geliefert" count={delivered.length} empty="Noch nichts geliefert.">
          {delivered.slice(0, RECENT_DELIVERED).map((o) => <OrderSummary key={o.id} order={o} />)}
          {delivered.length > RECENT_DELIVERED && <Link href="/network" className={`${linkCls} px-1 py-1`}>Alle gelieferten Aufträge</Link>}
        </Column>
      </div>
    </div>
  );
}
