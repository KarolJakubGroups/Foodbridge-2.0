import type { TransportOrder } from '../types';
import { fmtDateTime, fmtKg, TEMP_LABEL } from '../format';
import { Badge, Table, btnDark, btnPrimary } from './ui';

export type OrderAction = 'driver' | 'DISPATCHED' | 'COMPLETED';

export function OrderCard({ order, onAction, readOnly = false }: {
  order: TransportOrder; onAction?: (action: OrderAction, order: TransportOrder) => void; readOnly?: boolean;
}) {
  return (
    <div className="border border-slate-200 rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] text-slate-500">AUFTRAG #{order.id}</span>
          <Badge status={order.status} />
          <span className="text-xs font-bold">Abholstandort Spender: {order.donor.username}</span>
          <span className="text-[11px] text-slate-500 hidden md:inline">{order.donor.address}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px]">Termin: <b>{fmtDateTime(order.pickupTime)}</b></span>
          <span className="font-mono text-[11px] text-slate-600">{fmtKg(order.totalWeightKg)} / {order.totalPallets} Pal</span>
          {order.driverName && <span className="font-mono text-[11px] text-slate-600">Fahrer: {order.driverName}</span>}
          {!readOnly && onAction && order.status === 'PENDING' && (
            <>
              <button type="button" className="bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold px-3 py-1 rounded"
                onClick={() => onAction('driver', order)}>Fahrer zuweisen</button>
              <button type="button" className={btnDark} onClick={() => onAction('DISPATCHED', order)}>Disponieren</button>
            </>
          )}
          {!readOnly && onAction && order.status === 'DISPATCHED' && (
            <button type="button" className={btnPrimary.replace('px-4 py-2', 'px-3 py-1')} onClick={() => onAction('COMPLETED', order)}>
              Abschliessen
            </button>
          )}
        </div>
      </div>
      <Table
        rowKey={(d) => d.id}
        rows={order.donations}
        columns={[
          { key: 'p', label: 'Artikel', render: (d) => <b>{d.productName}</b> },
          { key: 't', label: 'Temp.', render: (d) => <span className="text-slate-600">{TEMP_LABEL[d.temperatureRange]}</span> },
          { key: 'm', label: 'Menge', className: 'font-mono', render: (d) => `${d.totalWeightKg} kg (${d.numberOfPallets} Pal)` },
          { key: 'w', label: 'Individuelles Zeitfenster (Start – Ende)', className: 'font-mono', render: (d) => `${fmtDateTime(d.overlapStart)} – ${fmtDateTime(d.overlapEnd)}` },
          { key: 's', label: 'Positionsstatus', render: (d) => <span className="font-mono text-[10px] text-slate-600">{d.status}</span> },
        ]}
      />
    </div>
  );
}
