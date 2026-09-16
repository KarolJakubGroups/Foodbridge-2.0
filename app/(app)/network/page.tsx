import { requireProfile } from '@/lib/auth';
import { fetchGlobalImpact, fetchTransportOrders } from '@/lib/queries';
import { fmtNumber } from '@/lib/format';
import { Card, Kpi } from '@/components/ui';
import { OrderCard } from '@/components/OrderCard';

export const dynamic = 'force-dynamic';

export default async function NetworkPage() {
  await requireProfile();
  const [orders, impact] = await Promise.all([fetchTransportOrders(), fetchGlobalImpact()]);
  const byStatus = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <div className="space-y-4">
      <Card title="Logistik-Netzwerk & Wirkungsbilanz" subtitle="Nationale Übersicht aller Galliker-Transportaufträge und des Impact-Trackings.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Gerettetes Gewicht" value={fmtNumber(impact.totalWeightKg)} unit="kg" />
          <Kpi label="Mahlzeiten" value={fmtNumber(impact.meals, 0)} unit="Portionen" />
          <Kpi label="CO₂-Einsparung" value={fmtNumber(impact.co2SavedKg)} unit="kg CO₂e" />
          <Kpi label="Transportaufträge" value={orders.length}
            unit={`(${byStatus('PENDING')} offen · ${byStatus('DISPATCHED')} unterwegs · ${byStatus('COMPLETED')} erledigt)`} />
        </div>
      </Card>
      <Card title="Transportaufträge">
        {orders.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Noch keine Transportaufträge disponiert.</p>}
        <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} order={o} readOnly />)}</div>
      </Card>
    </div>
  );
}
