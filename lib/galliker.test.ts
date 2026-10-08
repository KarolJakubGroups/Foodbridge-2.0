import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGallikerPayload, gallikerConfig, transmitToGalliker, validatePayload, type GallikerOrderPayload } from './galliker';

const order = {
  id: 42,
  createdAt: new Date('2026-09-25T08:00:00.000Z'),
  pickupStart: new Date('2026-09-26T07:00:00.000Z'),
  pickupEnd: new Date('2026-09-26T10:00:00.000Z'),
  donor: { organizationName: 'Migros Zürich', address: 'Limmatstrasse 152, 8005 Zürich', contactName: 'A. Muster', phone: '044 000 00 00' },
  claims: [
    { id: 1, pallets: 2, palletNumbers: [2, 3], weightKg: 100, donation: { productName: 'Milch', category: 'DAIRY_EGGS', temperatureRange: 'CHILLED', packagingUnit: 'Karton à 12 × 1 l', palletMaterial: 'EURO', palletWeights: [40, 45, 55], bestBeforeDate: '2026-10-01', pickupAddress: 'Limmatstrasse 152, 8005 Zürich' }, foodbank: { organizationName: 'Tafel Zürich', address: 'Hohlstrasse 400, 8048 Zürich' } },
    { id: 2, pallets: 1, palletNumbers: [1], weightKg: 20.5, donation: { productName: 'Brot', category: 'BAKERY', temperatureRange: 'AMBIENT', packagingUnit: null, palletMaterial: null, palletWeights: [20.5], bestBeforeDate: '2026-09-27', pickupAddress: 'Limmatstrasse 152, 8005 Zürich' }, foodbank: { organizationName: 'Tafel Winterthur', address: 'Zürcherstrasse 1, 8400 Winterthur' } },
  ],
};

describe('buildGallikerPayload', () => {
  it('describes pickup, window, destinations and totals', () => {
    const p = buildGallikerPayload(order);
    expect(p.externalOrderId).toBe('FB-42');
    expect(p.pickup).toMatchObject({ company: 'Migros Zürich', address: 'Limmatstrasse 152, 8005 Zürich', window: { start: '2026-09-26T07:00:00.000Z', end: '2026-09-26T10:00:00.000Z' } });
    expect(p.items.map((i) => [i.product, i.pallets, i.weightKg, i.deliverTo.institution])).toEqual([
      ['Milch', 2, 100, 'Tafel Zürich'], ['Brot', 1, 20.5, 'Tafel Winterthur'],
    ]);
    expect(p.items.map((i) => i.palletWeightsKg)).toEqual([[45, 55], [20.5]]);
    expect(p.items.map((i) => i.packagingUnit)).toEqual(['Karton à 12 × 1 l', null]);
    expect(p.items.map((i) => i.palletMaterial)).toEqual(['EURO', null]);
    expect(p.totals).toEqual({ pallets: 3, weightKg: 120.5, stops: 2 });
    expect(p.temperatureRequirement).toBe('CHILLED');
  });

  it('flags frozen loads and mixed storage', () => {
    const frozen = { ...order, claims: [{ ...order.claims[0], donation: { ...order.claims[0].donation, temperatureRange: 'FROZEN' } }] };
    expect(buildGallikerPayload(frozen).temperatureRequirement).toBe('FROZEN');
    const mixed = { ...order, claims: [...frozen.claims, order.claims[1]] };
    expect(buildGallikerPayload(mixed).temperatureRequirement).toBe('MIXED');
  });
});

describe('sandbox mode', () => {
  const sandbox = gallikerConfig({});

  it('is the default and accepts a valid order with a stable test reference', async () => {
    expect(sandbox.mode).toBe('SANDBOX');
    const payload = buildGallikerPayload(order);
    const first = await transmitToGalliker(payload, sandbox);
    const again = await transmitToGalliker(payload, sandbox);
    expect(first).toMatchObject({ ok: true, httpStatus: 201 });
    expect(first.ok && first.reference).toMatch(/^GLK-TEST-00042-/);
    expect(again.ok && again.reference).toBe(first.ok && first.reference);
  });

  it('rejects what a real endpoint would reject', async () => {
    const bad: GallikerOrderPayload = { ...buildGallikerPayload(order), items: [] };
    expect(validatePayload(bad)).toMatch(/ohne Positionen/);
    expect(await transmitToGalliker(bad, sandbox)).toMatchObject({ ok: false, httpStatus: 422 });
  });
});

describe('http mode against a local stand-in for Galliker', () => {
  let server: Server;
  let url = '';
  const received: { headers: IncomingHttpHeaders; body: unknown }[] = [];
  let respond: (res: import('node:http').ServerResponse) => void = () => {};

  beforeAll(async () => {
    server = createServer((req, res) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => {
        received.push({ headers: req.headers, body: JSON.parse(data) });
        respond(res);
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('posts the order with auth and idempotency headers and returns Galliker\'s reference', async () => {
    respond = (res) => { res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ reference: 'GLK-778899' })); };
    const config = gallikerConfig({ GALLIKER_MODE: 'http', GALLIKER_API_URL: url, GALLIKER_API_KEY: 'secret' });
    const result = await transmitToGalliker(buildGallikerPayload(order), config);

    expect(result).toMatchObject({ ok: true, reference: 'GLK-778899', httpStatus: 201 });
    const last = received.at(-1)!;
    expect(last.headers.authorization).toBe('Bearer secret');
    expect(last.headers['idempotency-key']).toBe('FB-42');
    expect((last.body as GallikerOrderPayload).items).toHaveLength(2);
  });

  it('reports HTTP errors, missing references and timeouts without throwing', async () => {
    const config = gallikerConfig({ GALLIKER_MODE: 'http', GALLIKER_API_URL: url, GALLIKER_TIMEOUT_MS: '300' });
    respond = (res) => { res.writeHead(503); res.end('busy'); };
    expect(await transmitToGalliker(buildGallikerPayload(order), config)).toMatchObject({ ok: false, httpStatus: 503 });

    respond = (res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); };
    expect(await transmitToGalliker(buildGallikerPayload(order), config)).toMatchObject({ ok: false, error: expect.stringMatching(/keine Auftragsnummer/) });

    respond = () => { /* never answer */ };
    expect(await transmitToGalliker(buildGallikerPayload(order), config)).toMatchObject({ ok: false, error: expect.stringMatching(/nicht rechtzeitig/) });
  });

  it('says so when no endpoint is configured', async () => {
    expect(await transmitToGalliker(buildGallikerPayload(order), gallikerConfig({ GALLIKER_MODE: 'http' }))).toMatchObject({ ok: false, error: expect.stringMatching(/GALLIKER_API_URL/) });
  });
});
