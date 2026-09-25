import { requireRole } from '@/lib/auth';
import { buildDispatchMap } from '@/lib/map-data';
import { PageHeader } from '@/components/ui';
import { DispatchMapLoader } from '@/components/DispatchMapLoader';

export const dynamic = 'force-dynamic';

export default async function DispatchMapPage() {
  await requireRole('DISPATCHER');
  const data = await buildDispatchMap();
  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Karte"
        subtitle="Abholadressen, Lieferungen an die Abgabestellen und die Fahrtrouten der geplanten und laufenden Transporte."
      />
      <DispatchMapLoader data={data} now={new Date().toISOString()} />
    </div>
  );
}
