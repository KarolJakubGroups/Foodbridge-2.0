'use client';

import dynamic from 'next/dynamic';
import type { MapData } from '@/lib/map-data';

// Leaflet needs the browser (window, DOM), so the map renders client-side only.
const DispatchMap = dynamic(() => import('./DispatchMap').then((m) => m.DispatchMap), {
  ssr: false,
  loading: () => <div className="h-[58vh] min-h-[360px] animate-pulse rounded-2xl bg-sand" aria-busy="true" />,
});

export function DispatchMapLoader({ data, now }: { data: MapData; now: string }) {
  return <DispatchMap data={data} now={now} />;
}
