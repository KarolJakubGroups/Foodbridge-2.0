import { requireProfile } from '@/lib/auth';
import { fetchImpactFor, fetchTransportOrders, orderScopeFor } from '@/lib/queries';
import { fmtNumber } from '@/lib/format';
import { Card, Kpi } from '@/components/ui';
import { OrderCard } from '@/components/OrderCard';

export const dynamic = 'force-dynamic';

const COPY = {
  DONOR: {
    title: 'Meine Transporte & Wirkungsbilanz',
    subtitle: 'Abholungen durch Galliker Logistics und die Wirkung Ihrer eigenen Spenden.',
    orders: 'Meine Transportaufträge',
    empty: 'Noch keine Abholung geplant. Sobald eine Abgabestelle eine Ihrer Spenden reserviert hat und der Transport disponiert ist, erscheint er hier.',
  },
  FOODBANK: {
    title: 'Meine Lieferungen & Wirkungsbilanz',
    subtitle: 'Transporte mit Ihren reservierten Spenden und die Wirkung Ihrer Allokationen.',
    orders: 'Transporte mit meinen Reservierungen',
    empty: 'Noch keine Transporte mit Ihren Reservierungen disponiert.',
  },
  DISPATCHER: {
    title: 'Logistik-Netzwerk & Wirkungsbilanz',
    subtitle: 'Nationale Übersicht aller Galliker-Transportaufträge und des Impact-Trackings.',
    orders: 'Alle Transportaufträge',
    empty: 'Noch keine Transportaufträge disponiert.',
  },
} as const;

export default async function NetworkPage() {
  const profile = await requireProfile();
  const copy = COPY[profile.role];
  const [orders, impact] = await Promise.all([
    fetchTransportOrders(orderScopeFor(profile)),
    fetchImpactFor(profile.id, profile.role),
  ]);
  const byStatus = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <div className="space-y-3 md:space-y-4">
      <Card title={copy.title} subtitle={copy.subtitle}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Gerettetes Gewicht" value={fmtNumber(impact.totalWeightKg)} unit="kg" />
          <Kpi label="Mahlzeiten" value={fmtNumber(impact.meals, 0)} unit="Portionen" />
          <Kpi label="CO₂-Einsparung" value={fmtNumber(impact.co2SavedKg)} unit="kg CO₂e" />
          <Kpi label="Transportaufträge" value={orders.length}
            unit={`(${byStatus('PENDING')} offen · ${byStatus('DISPATCHED')} unterwegs · ${byStatus('COMPLETED')} erledigt)`} />
        </div>
      </Card>
      <Card title={copy.orders}>
        {orders.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">{copy.empty}</p>}
        <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} order={o} readOnly />)}</div>
      </Card>
    </div>
  );
}
