import { requireProfile } from '@/lib/auth';
import { fetchImpactFor, fetchTransportOrders, orderScopeFor } from '@/lib/queries';
import { fmtNumber } from '@/lib/format';
import { EmptyState, PageHeader, SectionTitle, Stat } from '@/components/ui';
import { TruckIcon } from '@/components/icons';
import { OrderCard } from '@/components/OrderCard';

export const dynamic = 'force-dynamic';

const COPY = {
  DONOR: {
    title: 'Meine Transporte',
    subtitle: 'Wann Ihre Spenden abgeholt werden und was sie bewirkt haben.',
    impact: 'Ihre Spenden bisher',
    empty: 'Sobald eine Abgabestelle eine Ihrer Spenden reserviert und die Disposition die Fahrt plant, erscheint sie hier.',
  },
  FOODBANK: {
    title: 'Meine Lieferungen',
    subtitle: 'Fahrten mit Lebensmitteln, die Sie reserviert haben.',
    impact: 'Bisher für Sie gerettet',
    empty: 'Sobald die Disposition eine Fahrt mit Ihren Reservierungen plant, erscheint sie hier.',
  },
  DISPATCHER: {
    title: 'Netzwerk & Wirkung',
    subtitle: 'Alle Fahrten in der Schweiz und was sie bewirkt haben.',
    impact: 'Insgesamt gerettet',
    empty: 'Noch keine Aufträge. Erstellen Sie unter «Transporte planen» einen Vorschlag.',
  },
} as const;

export default async function NetworkPage() {
  const profile = await requireProfile();
  const copy = COPY[profile.role];
  const [orders, impact] = await Promise.all([
    fetchTransportOrders(orderScopeFor(profile)),
    fetchImpactFor(profile.id, profile.role),
  ]);
  const now = new Date().toISOString();
  const upcoming = orders.filter((o) => o.status !== 'COMPLETED');
  const delivered = orders.filter((o) => o.status === 'COMPLETED').reverse();

  return (
    <div className="space-y-10">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <section className="space-y-4">
        <SectionTitle>{copy.impact}</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Stat className="bg-white border border-line" label="kg Lebensmittel gerettet" value={fmtNumber(impact.totalWeightKg, 0)} />
          <Stat className="bg-white border border-line" label="Mahlzeiten" value={`≈ ${fmtNumber(impact.meals, 0)}`} />
          <Stat className="bg-white border border-line" label="kg CO₂ eingespart" value={fmtNumber(impact.co2SavedKg, 0)} />
          <Stat className="bg-white border border-line" label="Fahrten geplant oder unterwegs" value={upcoming.length} />
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl">
          <EmptyState icon={<TruckIcon className="size-6" />} title="Noch keine Fahrten">{copy.empty}</EmptyState>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-4">
              <SectionTitle aside={String(upcoming.length)}>Anstehend</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                {upcoming.map((o) => <OrderCard key={o.id} order={o} now={now} readOnly />)}
              </div>
            </section>
          )}
          {delivered.length > 0 && (
            <section className="space-y-4">
              <SectionTitle aside={String(delivered.length)}>Geliefert</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                {delivered.map((o) => <OrderCard key={o.id} order={o} now={now} readOnly />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
