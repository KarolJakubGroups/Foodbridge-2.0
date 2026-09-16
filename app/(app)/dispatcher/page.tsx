import { requireRole } from '@/lib/auth';
import { countUnbundledClaimed, fetchTransportOrders } from '@/lib/queries';
import { Card } from '@/components/ui';
import { BundleButton } from '@/components/BundleButton';
import { OrderCard } from '@/components/OrderCard';

export const dynamic = 'force-dynamic';

export default async function DispatcherPage() {
  await requireRole('DISPATCHER');
  const [orders, claimedCount] = await Promise.all([fetchTransportOrders(), countUnbundledClaimed()]);

  return (
    <div className="space-y-4">
      <Card title="Galliker Logistik-Konsolidierungszentrum"
        subtitle="Mathematische Schnittmengenberechnung zur Optimierung von Abholfenstern (Intervall-Scheduling).">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="font-mono text-[11px] text-slate-600">Beanspruchte Spenden ohne Transportauftrag: <b>{claimedCount}</b></p>
          <div className="flex-1 min-w-64"><BundleButton /></div>
        </div>
      </Card>
      <Card title={`Disponierte Transportaufträge (${orders.length})`}>
        {orders.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Noch keine Transportaufträge. Bündelung starten.</p>}
        <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} order={o} />)}</div>
      </Card>
    </div>
  );
}
