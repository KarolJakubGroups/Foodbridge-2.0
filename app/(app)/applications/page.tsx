import { requireRole } from '@/lib/auth';
import { listApplications } from '@/lib/services';
import { fmtDateTime } from '@/lib/format';
import type { Application } from '@/lib/types';
import { Badge, Card } from '@/components/ui';
import { ApplicationActions } from '@/components/ApplicationActions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { PENDING: 'Offen', APPROVED: 'Freigegeben', REJECTED: 'Abgelehnt' };

function ApplicationRow({ a }: { a: Application }) {
  return (
    <li className="border border-slate-200 rounded-md p-3 md:p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm">{a.organizationName}</span>
          <Badge status={a.status === 'PENDING' ? 'PENDING' : a.status === 'APPROVED' ? 'COMPLETED' : 'CLAIMED'} />
          <span className="text-[11px] text-slate-500">{STATUS_LABEL[a.status]}</span>
        </div>
        <div className="text-xs text-slate-600">{a.address}</div>
        <div className="text-xs text-slate-600">
          {a.contactName ?? '–'}{a.phone ? ` · ${a.phone}` : ''} · <a className="underline" href={`mailto:${a.email}`}>{a.email}</a>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Beantragt {fmtDateTime(a.createdAt)}{a.reviewedAt ? ` · Entschieden ${fmtDateTime(a.reviewedAt)}` : ''} · Kennung {a.username}
        </div>
      </div>
      <ApplicationActions donorId={a.id} status={a.status} />
    </li>
  );
}

export default async function ApplicationsPage() {
  await requireRole('FOODBANK');
  const all = await listApplications();
  const open = all.filter((a) => a.status === 'PENDING');
  const decided = all.filter((a) => a.status !== 'PENDING');

  return (
    <div className="space-y-3 md:space-y-4">
      <Card title={`Offene Anträge (${open.length})`} subtitle="Unternehmen, die als Spender freigegeben werden möchten. Erst nach der Freigabe können sie Spenden erfassen.">
        {open.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Keine offenen Anträge.</p>}
        <ul className="space-y-2">{open.map((a) => <ApplicationRow key={a.id} a={a} />)}</ul>
      </Card>
      <Card title={`Verifizierte und abgelehnte Spender (${decided.length})`}>
        {decided.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Noch keine Entscheidungen.</p>}
        <ul className="space-y-2">{decided.map((a) => <ApplicationRow key={a.id} a={a} />)}</ul>
      </Card>
    </div>
  );
}
