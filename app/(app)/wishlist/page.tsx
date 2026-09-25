import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { fetchWishlists } from '@/lib/queries';
import { fmtDateOfInstant, fmtKg } from '@/lib/format';
import { Card, EmptyState, PageHeader, btn } from '@/components/ui';
import { ListIcon, PlusIcon } from '@/components/icons';
import { WishlistForm } from '@/components/WishlistForm';
import { DeleteWishlistButton } from '@/components/DeleteWishlistButton';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const profile = await requireProfile();
  const items = await fetchWishlists();
  const isFoodbank = profile.role === 'FOODBANK';
  const isDonor = profile.role === 'DONOR';

  return (
    <div className="space-y-8">
      <PageHeader
        title={isFoodbank ? 'Bedarf melden' : 'Gesuchte Produkte'}
        subtitle={isFoodbank
          ? 'Sagen Sie Spendern, was Ihnen gerade fehlt. Alle Spender sehen diese Liste.'
          : 'Das brauchen soziale Institutionen gerade besonders.'}
        actions={isDonor ? <Link href="/donor/new" className={btn('primary')}><PlusIcon className="size-5" />Überschuss melden</Link> : undefined}
      />
      <div className={`grid grid-cols-1 gap-6 lg:gap-7 items-start ${isFoodbank ? 'lg:grid-cols-[400px_minmax(0,1fr)]' : ''}`}>
        {isFoodbank && (
          <Card title="Neuer Bedarf">
            <WishlistForm />
          </Card>
        )}
        <Card title={isFoodbank ? 'Aktuell gesucht' : undefined} flush={isFoodbank}>
          {items.length === 0 ? (
            <EmptyState icon={<ListIcon className="size-6" />} title="Gerade wird nichts Bestimmtes gesucht">
              {isFoodbank ? 'Melden Sie links, was Ihnen fehlt.' : 'Schauen Sie später wieder vorbei.'}
            </EmptyState>
          ) : (
            <ul className={isFoodbank ? '' : '-my-5 md:-my-6'}>
              {items.map((w) => (
                <li key={w.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-1 py-4 items-center ${isFoodbank ? 'px-5 md:px-7 border-t border-line-soft' : 'border-t border-line-soft first:border-t-0'}`}>
                  <div className="min-w-0">
                    <div className="text-[17px] font-semibold text-ink">{w.productName}</div>
                    <div className="text-[15px] text-muted">{w.foodbank.organizationName} · seit {fmtDateOfInstant(w.createdAt)}</div>
                    {w.note && <div className="text-[15px] text-ink-2 mt-1">{w.note}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-ink tabular-nums whitespace-nowrap">{fmtKg(w.quantityKg)}</span>
                    {isFoodbank && w.foodbank.id === profile.id && <DeleteWishlistButton id={w.id} productName={w.productName} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
