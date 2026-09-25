'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapData, MapOrder } from '@/lib/map-data';
import { fmtKg, fmtPallets, fmtWindow } from '@/lib/format';
import { Pill, TONE, TransportBadge } from '@/components/ui';
import { AlertIcon, SnowflakeIcon, ThermometerIcon } from '@/components/icons';

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const COLOR = { PENDING: '#6d28d9', DISPATCHED: '#d97706', stop: '#1d6b45', waiting: '#667085' } as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function pin(color: string, label: string, width = 34, ring = false): L.DivIcon {
  const size = Math.min(width, 36);
  return L.divIcon({
    className: '',
    iconSize: [width, size],
    iconAnchor: [width / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${width}px;height:${size}px;background:${ring ? '#fff' : color};color:${ring ? color : '#fff'};border:3px solid ${ring ? color : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35)" class="rounded-full flex items-center justify-center text-[13px] font-bold">${esc(label)}</div>`,
  });
}

function orderPopup(o: MapOrder, now: Date): string {
  const route = o.distanceKm !== null ? `<br>Strecke ${o.distanceKm} km · ca. ${o.durationMin} Min Fahrzeit` : '';
  return `<b>Auftrag ${o.id} · ${esc(o.donor)}</b><br>${esc(o.pickup.address)}<br>Abholfenster ${esc(fmtWindow(o.window.start, o.window.end, now))}<br>${esc(fmtPallets(o.pallets))} · ${esc(fmtKg(o.weightKg))}${route}`;
}

export function DispatchMap({ data, now: nowIso }: { data: MapData; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef(new Map<number, L.FeatureGroup>());
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const map = L.map(containerRef.current!, { scrollWheelZoom: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende' }).addTo(map);
    const all = L.featureGroup().addTo(map);
    const groups = groupsRef.current;
    groups.clear();

    // Orders that share a pickup address get one pin labelled with all their numbers.
    const atPickup = new Map<string, MapOrder[]>();
    for (const o of data.orders) {
      if (!o.pickup.point) continue;
      const key = `${o.pickup.point.lat.toFixed(5)},${o.pickup.point.lng.toFixed(5)}`;
      atPickup.set(key, [...(atPickup.get(key) ?? []), o]);
    }

    for (const o of data.orders) {
      const g = L.featureGroup();
      const color = COLOR[o.status];
      const located = o.stops.filter((s) => s.point);
      if (o.route) {
        L.polyline(o.route.map(([lng, lat]) => [lat, lng] as L.LatLngTuple), { color, weight: 5, opacity: 0.85 }).addTo(g);
      } else if (o.pickup.point) {
        // No driving route available: straight dashed lines so the connection is still visible.
        for (const s of located) {
          L.polyline([[o.pickup.point.lat, o.pickup.point.lng], [s.point!.lat, s.point!.lng]], { color, weight: 3, dashArray: '6 8', opacity: 0.8 }).addTo(g);
        }
      }
      if (o.pickup.point) {
        const key = `${o.pickup.point.lat.toFixed(5)},${o.pickup.point.lng.toFixed(5)}`;
        const here = atPickup.get(key)!;
        if (here[0] === o) {
          const label = here.map((h) => h.id).join('·');
          const anyUnderway = here.some((h) => h.status === 'DISPATCHED');
          L.marker([o.pickup.point.lat, o.pickup.point.lng], {
            icon: pin(anyUnderway ? COLOR.DISPATCHED : COLOR.PENDING, label, Math.max(36, 16 + label.length * 8)),
            zIndexOffset: 500,
            title: here.length === 1 ? `Auftrag ${o.id}: Abholung ${o.donor}` : `Aufträge ${here.map((h) => h.id).join(', ')}: Abholung ${o.donor}`,
          }).bindPopup(here.map((h) => orderPopup(h, now)).join('<hr style="margin:6px 0">')).addTo(g);
        }
      }
      for (const s of located) {
        L.marker([s.point!.lat, s.point!.lng], { icon: pin(COLOR.stop, '⌂', 30), title: `Lieferung an ${s.name}` })
          .bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.address)}<br>${esc(fmtPallets(s.pallets))} aus Auftrag ${o.id}`).addTo(g);
      }
      g.on('click', () => setSelected(o.id));
      g.addTo(all);
      groups.set(o.id, g);
    }

    for (const w of data.waiting) {
      if (!w.point) continue;
      L.marker([w.point.lat, w.point.lng], { icon: pin(COLOR.waiting, String(w.reservations), 30, true), title: `${w.donor}: ${w.reservations} Reservierungen warten` })
        .bindPopup(`<b>${esc(w.donor)}</b><br>${esc(w.address)}<br>${w.reservations} ${w.reservations === 1 ? 'Reservierung wartet' : 'Reservierungen warten'} auf einen Transport<br>${esc(fmtPallets(w.pallets))} · ${esc(fmtKg(w.weightKg))}`)
        .addTo(all);
    }

    const bounds = all.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    else map.setView([46.8, 8.23], 8); // Switzerland
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [data, now]);

  const focus = (id: number) => {
    setSelected(id);
    const g = groupsRef.current.get(id);
    const map = mapRef.current;
    if (!g || !map) return;
    const b = g.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [50, 50], maxZoom: 14 });
    g.eachLayer((layer) => { if (layer instanceof L.Marker && layer.getPopup()) layer.openPopup(); });
  };

  const hasPoints = data.orders.some((o) => o.pickup.point) || data.waiting.some((w) => w.point);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 lg:gap-6 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="relative isolate z-0 overflow-hidden rounded-2xl border border-line bg-sand">
          <div ref={containerRef} className="h-[58vh] min-h-[360px] lg:h-[calc(100vh-260px)] lg:min-h-[480px] w-full" role="img"
            aria-label="Karte mit Abholadressen, Lieferadressen und Fahrtrouten. Die gleichen Angaben stehen in der Liste." />
          {!hasPoints && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center p-6 text-center text-[15px] text-muted bg-white/70">
              Noch keine Adressen auf der Karte. Sobald Reservierungen oder Aufträge vorliegen, erscheinen sie hier.
            </div>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-label="Legende">
          <li className="flex items-center gap-2"><span className="size-3.5 rounded-full" style={{ background: COLOR.PENDING }} />Abholung, zu disponieren</li>
          <li className="flex items-center gap-2"><span className="size-3.5 rounded-full" style={{ background: COLOR.DISPATCHED }} />Abholung, unterwegs</li>
          <li className="flex items-center gap-2"><span className="size-3.5 rounded-full" style={{ background: COLOR.stop }} />Lieferung an Abgabestelle</li>
          <li className="flex items-center gap-2"><span className="size-3.5 rounded-full border-[3px]" style={{ borderColor: COLOR.waiting }} />Reservierungen ohne Transport</li>
          <li className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-muted" />Luftlinie, Route nicht verfügbar</li>
        </ul>
      </div>

      <aside className="flex flex-col gap-4">
        {data.unlocated.length > 0 && (
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[15px] ${TONE.orange}`}>
            <AlertIcon className="size-5 shrink-0 mt-0.5" />
            <span>
              {data.unlocated.length === 1 ? 'Eine Adresse konnte' : `${data.unlocated.length} Adressen konnten`} noch nicht auf der Karte gefunden werden:
              {' '}{data.unlocated.slice(0, 3).join('; ')}{data.unlocated.length > 3 ? ' …' : ''}. Die Suche läuft im Hintergrund weiter; bitte die Seite später neu laden.
            </span>
          </div>
        )}
        <section className="bg-white border border-line rounded-2xl">
          <h2 className="px-5 pt-5 pb-3 text-lg font-bold text-ink">Fahrten ({data.orders.length})</h2>
          {data.orders.length === 0 ? (
            <p className="px-5 pb-5 text-[15px] text-muted">Keine geplanten oder laufenden Fahrten.</p>
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {data.orders.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => focus(o.id)} aria-pressed={selected === o.id}
                    className={`w-full text-left px-5 py-4 flex flex-col gap-1.5 hover:bg-sand focus-visible:outline-none focus-visible:bg-sand ${selected === o.id ? 'bg-brand-50' : ''}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-ink">Auftrag {o.id} · {o.donor}</span>
                      <TransportBadge status={o.status} />
                    </span>
                    <span className="text-[15px] text-ink-2">{fmtWindow(o.window.start, o.window.end, now)}</span>
                    <span className="text-sm text-muted">
                      {fmtPallets(o.pallets)} · {fmtKg(o.weightKg)} · {o.stops.length === 1 ? '1 Lieferadresse' : `${o.stops.length} Lieferadressen`}
                      {o.distanceKm !== null ? ` · ${o.distanceKm} km, ca. ${o.durationMin} Min` : ''}
                    </span>
                    {o.cold && (
                      <Pill tone={o.cold === 'frozen' ? 'frozen' : 'cold'} className="self-start">
                        {o.cold === 'frozen' ? <SnowflakeIcon className="size-4" /> : <ThermometerIcon className="size-4" />}
                        {o.cold === 'frozen' ? 'Tiefkühlfahrzeug' : 'Kühlfahrzeug'}
                      </Pill>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {data.waiting.length > 0 && (
          <section className="bg-white border border-line rounded-2xl">
            <h2 className="px-5 pt-5 pb-3 text-lg font-bold text-ink">Warten auf einen Transport</h2>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {data.waiting.map((w) => (
                <li key={w.key} className="px-5 py-3.5 flex flex-col gap-0.5">
                  <span className="text-base font-semibold text-ink">{w.donor}</span>
                  <span className="text-sm text-muted">{w.address}</span>
                  <span className="text-sm text-muted">{w.reservations} {w.reservations === 1 ? 'Reservierung' : 'Reservierungen'} · {fmtPallets(w.pallets)} · {fmtKg(w.weightKg)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
