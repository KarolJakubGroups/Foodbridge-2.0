import { requireProfile } from '@/lib/auth';
import { fetchWishlists } from '@/lib/queries';
import { fmtDateTime, fmtKg } from '@/lib/format';
import { Card, TableShell, tdCls, trCls } from '@/components/ui';
import { WishlistForm } from '@/components/WishlistForm';
import { DeleteWishlistButton } from '@/components/DeleteWishlistButton';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const profile = await requireProfile();
  const items = await fetchWishlists();
  const isFoodbank = profile.role === 'FOODBANK';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {isFoodbank && (
        <Card className="lg:col-span-2" title="Bedarf veröffentlichen" subtitle="Spender sehen Ihren spezifischen Bedarf.">
          <WishlistForm />
        </Card>
      )}
      <Card className={isFoodbank ? 'lg:col-span-3' : 'lg:col-span-5'} title="Bedarfsanforderungen sozialer Institutionen">
        <TableShell isEmpty={items.length === 0}
          headers={[{ label: 'Institution' }, { label: 'Produkt' }, { label: 'Menge' }, { label: 'Hinweis' }, { label: 'Gemeldet am' }, ...(isFoodbank ? [{ label: '' }] : [])]}>
          {items.map((w) => (
            <tr key={w.id} className={trCls}>
              <td className={tdCls}><b>{w.foodbank.organizationName}</b></td>
              <td className={tdCls}>{w.productName}</td>
              <td className={`${tdCls} font-mono`}>{fmtKg(w.quantityKg)}</td>
              <td className={`${tdCls} text-slate-600`}>{w.note ?? '–'}</td>
              <td className={`${tdCls} font-mono text-slate-500`}>{fmtDateTime(w.createdAt)}</td>
              {isFoodbank && <td className={tdCls}>{w.foodbank.id === profile.id && <DeleteWishlistButton id={w.id} />}</td>}
            </tr>
          ))}
        </TableShell>
      </Card>
    </div>
  );
}
