import { requireRole } from '@/lib/auth';
import { listApplications } from '@/lib/services';
import { fmtDateOfInstant } from '@/lib/format';
import type { Application } from '@/lib/types';
import { ApplicationBadge, Card, EmptyState, PageHeader, SectionTitle, linkCls } from '@/components/ui';
import { UserCheckIcon } from '@/components/icons';
import { ApplicationActions } from '@/components/ApplicationActions';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
function ago(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(date).getTime()) / DAY);
  if (days <= 0) return 'Heute beantragt';
  if (days === 1) return 'Gestern beantragt';
  return `Vor ${days} Tagen beantragt`;
}

function PendingCard({ a, now }: { a: Application; now: Date }) {
  return (
    <article className="bg-white border border-line rounded-2xl p-5 md:p-7 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-xl font-bold text-ink">{a.organizationName}</h3>
          <p className="text-[15px] text-muted">{ago(a.createdAt, now)}</p>
        </div>
        <ApplicationBadge status={a.status} />
      </div>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[140px_minmax(0,1fr)] gap-y-2.5 text-base">
        <dt className="text-muted">Kontakt</dt><dd className="font-semibold text-ink">{a.contactName ?? '–'}</dd>
        <dt className="text-muted">Telefon</dt><dd>{a.phone ? <a href={`tel:${a.phone}`} className={linkCls}>{a.phone}</a> : '–'}</dd>
        <dt className="text-muted">E-Mail</dt><dd className="truncate"><a href={`mailto:${a.email}`} className={linkCls}>{a.email}</a></dd>
        <dt className="text-muted">Abholadresse</dt><dd>{a.address}</dd>
      </dl>
      <ApplicationActions donorId={a.id} status={a.status} organizationName={a.organizationName} />
    </article>
  );
}

export default async function ApplicationsPage() {
  await requireRole('FOODBANK');
  const all = await listApplications();
  const now = new Date();
  const open = all.filter((a) => a.status === 'PENDING');
  const decided = all.filter((a) => a.status !== 'PENDING');

  return (
    <div className="space-y-10 max-w-6xl">
      <PageHeader title="Spender-Anträge"
        subtitle="Diese Unternehmen möchten Lebensmittel spenden. Prüfen Sie die Angaben und geben Sie sie frei. Erst dann können sie Angebote melden." />

      <section className="space-y-4">
        <SectionTitle aside={open.length > 0 ? String(open.length) : undefined}>Warten auf Ihre Prüfung</SectionTitle>
        {open.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl">
            <EmptyState icon={<UserCheckIcon className="size-6" />} title="Alles erledigt">Im Moment wartet kein Antrag auf Ihre Prüfung.</EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{open.map((a) => <PendingCard key={a.id} a={a} now={now} />)}</div>
        )}
      </section>

      {decided.length > 0 && (
        <Card title="Bereits entschieden" flush>
          <ul>
            {decided.map((a) => (
              <li key={a.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_170px_130px_auto] gap-x-5 gap-y-2 px-5 md:px-7 py-4 border-t border-line-soft items-center">
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold text-ink truncate">{a.organizationName}</div>
                  <div className="text-[15px] text-muted truncate">{a.address}</div>
                </div>
                <span className="text-[15px] text-muted">{a.reviewedAt ? `Am ${fmtDateOfInstant(a.reviewedAt)}` : '–'}</span>
                <span><ApplicationBadge status={a.status} /></span>
                <div className="sm:col-span-2 lg:col-span-1"><ApplicationActions donorId={a.id} status={a.status} organizationName={a.organizationName} compact /></div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
