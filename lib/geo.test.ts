import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));

import { distanceKm, fetchRoute, geocodeAddress, orderStops } from './geo';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('geocodeAddress', () => {
  it('asks Nominatim for Swiss addresses with a User-Agent and parses the first hit', async () => {
    const fetchImpl = vi.fn(() => json([{ lat: '47.3856', lon: '8.5313', display_name: 'Limmatstrasse 152, Zürich' }]));
    const hit = await geocodeAddress('limmatstrasse 152, 8005 zürich', fetchImpl as unknown as typeof fetch);
    expect(hit).toEqual({ lat: 47.3856, lng: 8.5313, displayName: 'Limmatstrasse 152, Zürich' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=ch');
    expect(url).toContain(encodeURIComponent('limmatstrasse 152, 8005 zürich'));
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/FoodBridge/);
  });

  it('returns null when nothing is found and throws on server errors', async () => {
    expect(await geocodeAddress('nowhere', (() => json([])) as unknown as typeof fetch)).toBeNull();
    await expect(geocodeAddress('x', (() => json({}, 503)) as unknown as typeof fetch)).rejects.toThrow(/503/);
  });
});

describe('fetchRoute', () => {
  it('requests a driving route in lng,lat order and converts units', async () => {
    const fetchImpl = vi.fn(() => json({ code: 'Ok', routes: [{ geometry: { coordinates: [[8.53, 47.38], [8.49, 47.39]] }, distance: 4204.8, duration: 482 }] }));
    const route = await fetchRoute([{ lat: 47.38, lng: 8.53 }, { lat: 47.39, lng: 8.49 }], fetchImpl as unknown as typeof fetch);
    expect(route).toEqual({ coordinates: [[8.53, 47.38], [8.49, 47.39]], distanceKm: 4.2, durationMin: 8 });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toContain('/route/v1/driving/8.530000,47.380000;8.490000,47.390000');
  });

  it('gives no route for a single point or a failed lookup', async () => {
    expect(await fetchRoute([{ lat: 47, lng: 8 }])).toBeNull();
    expect(await fetchRoute([{ lat: 47, lng: 8 }, { lat: 47.1, lng: 8.1 }], (() => json({ code: 'NoRoute' })) as unknown as typeof fetch)).toBeNull();
  });
});

describe('orderStops', () => {
  it('starts at the pickup and visits the nearest stop next', () => {
    const zurich = { lat: 47.3769, lng: 8.5417 };
    const winterthur = { lat: 47.4988, lng: 8.7237 };
    const altstetten = { lat: 47.3914, lng: 8.4891 };
    expect(orderStops(zurich, [winterthur, altstetten])).toEqual([zurich, altstetten, winterthur]);
    expect(Math.round(distanceKm(zurich, winterthur))).toBe(19);
  });
});
