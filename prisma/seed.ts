/**
 * Seeds demo accounts, offers and reservations (idempotent). Run with `npm run seed`.
 *
 * The data shows every feature on first login:
 *   - a partial reservation (Milch: 1 of 2 pallets reserved, 1 still free)
 *   - an offer whose pallets weigh differently (Tiefkühl-Gemüse), so institutions pick pallets
 *   - a transport order with two delivery stops (Zürich and Winterthur), already sent to Galliker's test connection
 *   - reservations waiting for bundling, an expired offer, and a 5-day-old offer hidden by the 4-day rule
 * Coordinates of the demo addresses are cached so the dispatcher map works without a geocoding call.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeAddress } from '../lib/domain';
import { bundleWindow } from '../lib/logistics';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (see .env.example)');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PASSWORD = 'password';

const ACCOUNTS = [
  { username: 'migros', role: 'DONOR', organizationName: 'Migros Genossenschaft Zürich', address: 'Limmatstrasse 152, 8005 Zürich', contactName: 'Sandra Keller', phone: '044 277 21 11' },
  { username: 'coop', role: 'DONOR', organizationName: 'Coop Verteilzentrale Dietikon', address: 'Riedstrasse 10, 8953 Dietikon', contactName: 'Marco Frei', phone: '044 745 11 00' },
  { username: 'foodbank_zrh', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Zürich', address: 'Hohlstrasse 400, 8048 Zürich', contactName: null, phone: null },
  { username: 'foodbank_win', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Winterthur', address: 'Zürcherstrasse 45, 8400 Winterthur', contactName: null, phone: null },
  { username: 'dispatcher_gt', role: 'DISPATCHER', organizationName: 'Galliker Transport AG', address: 'Kantonsstrasse 2, 6246 Altishofen', contactName: null, phone: null },
];

/** Looked up once with Nominatim (OpenStreetMap). */
const COORDINATES: Record<string, [number, number]> = {
  'Limmatstrasse 152, 8005 Zürich': [47.3856745, 8.5313593],
  'Riedstrasse 10, 8953 Dietikon': [47.4200085, 8.3947802],
  'Hohlstrasse 400, 8048 Zürich': [47.3866606, 8.5036659],
  'Zürcherstrasse 45, 8400 Winterthur': [47.4987856, 8.7233563],
  'Kantonsstrasse 2, 6246 Altishofen': [47.2003963, 7.9716205],
};

/** Packaging units shown on some demo offers. */
const PACKAGING: Record<string, string> = {
  'Milch UHT 1l': 'Karton à 12 × 1 l', 'Äpfel Gala': 'Kiste à 13 kg', 'Tiefkühl-Gemüse': 'Beutel à 2,5 kg',
};

const days = (n: number, hour = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const dateIn = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function main() {
  for (const [address, [latitude, longitude]] of Object.entries(COORDINATES)) {
    const query = normalizeAddress(address);
    await prisma.geocodedAddress.upsert({ where: { query }, update: {}, create: { query, latitude, longitude, displayName: address } });
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: Record<string, { id: string; address: string }> = {};
  for (const a of ACCOUNTS) {
    const u = await prisma.user.upsert({
      where: { username: a.username },
      update: {},
      create: {
        username: a.username, email: `${a.username}@demo.foodbridge.ch`, passwordHash, role: a.role, status: 'APPROVED',
        organizationName: a.organizationName, address: a.address, contactName: a.contactName, phone: a.phone,
      },
    });
    users[a.username] = { id: u.id, address: u.address };
  }
  console.log('accounts ready:', Object.keys(users).join(', '));

  if ((await prisma.donation.count()) > 0) {
    console.log('donations already present; skipping data seed');
    return;
  }

  const { migros, coop, foodbank_zrh: zrh, foodbank_win: win } = users;
  const offer = async (donor: { id: string; address: string }, productName: string, category: string, temperatureRange: string,
    bestBeforeInDays: number, numberOfPallets: number, weight: number | number[], start: Date, end: Date, createdAt: Date,
    claims: { foodbank: { id: string }; pallets: number }[] = []) => {
    // One weight for every pallet, or each pallet's own weight.
    const palletWeights = Array.isArray(weight) ? weight : Array.from({ length: numberOfPallets }, () => weight);
    const claimedPallets = claims.reduce((s, c) => s + c.pallets, 0);
    const d = await prisma.donation.create({
      data: {
        donorId: donor.id, productName, category, temperatureRange, packagingUnit: PACKAGING[productName] ?? null, palletMaterial: productName === 'Brot vom Vortag' ? 'DISPOSABLE' : 'EURO', bestBeforeDate: dateIn(bestBeforeInDays), pickupAddress: donor.address,
        numberOfPallets, palletWeights, overlapStart: start, overlapEnd: end, createdAt,
        claimedPallets, status: claimedPallets === numberOfPallets ? 'CLAIMED' : 'AVAILABLE',
      },
    });
    const created = [];
    let next = 1; // claims take the pallets in order
    for (const c of claims) {
      const palletNumbers = Array.from({ length: c.pallets }, () => next++);
      const weightKg = palletNumbers.reduce((s, n) => s + palletWeights[n - 1], 0);
      created.push(await prisma.claim.create({
        data: { donationId: d.id, foodbankId: c.foodbank.id, pallets: c.pallets, palletNumbers, weightKg, claimedAt: hoursAgo(2) },
      }));
    }
    return { donation: d, claims: created };
  };

  // Migros: Äpfel and Birnen share a pickup window -> one truck to Zürich and Winterthur.
  const apples = await offer(migros, 'Äpfel Gala', 'FRUIT_VEG', 'AMBIENT', 12, 1, 50, days(1, 7), days(1, 12), hoursAgo(3), [{ foodbank: zrh, pallets: 1 }]);
  const pears = await offer(migros, 'Birnen', 'FRUIT_VEG', 'COOL', 10, 2, 30, days(1, 8), days(1, 16), hoursAgo(3), [{ foodbank: zrh, pallets: 1 }, { foodbank: win, pallets: 1 }]);
  // Reserved, waiting for bundling.
  await offer(migros, 'Orangen', 'FRUIT_VEG', 'AMBIENT', 14, 1, 40, days(3, 7), days(3, 12), hoursAgo(1), [{ foodbank: zrh, pallets: 1 }]);
  // Still open.
  await offer(migros, 'Brot vom Vortag', 'BAKERY', 'AMBIENT', 2, 1, 20, days(1, 6), days(1, 10), hoursAgo(3));
  // Nobody reserved in time: "Abgelaufen" on the donor dashboard.
  await offer(migros, 'Blattsalat', 'FRUIT_VEG', 'CHILLED', 2, 1, 15, days(-1, 7), days(0, 6), hoursAgo(5 * 24));

  await offer(coop, 'Bananen', 'FRUIT_VEG', 'CHILLED', 6, 1, 30, days(2, 7), days(2, 15), hoursAgo(24), [{ foodbank: win, pallets: 1 }]);
  // Partial reservation: 1 of 2 pallets taken, the other still available.
  await offer(coop, 'Milch UHT 1l', 'DAIRY_EGGS', 'CHILLED', 20, 2, 50, days(1, 7), days(3, 17), hoursAgo(6), [{ foodbank: zrh, pallets: 1 }]);
  // Pallets of different weight: institutions choose which ones they take.
  await offer(coop, 'Tiefkühl-Gemüse', 'READY_MEALS', 'FROZEN', 90, 3, [280, 240, 190], days(2, 7), days(2, 12), hoursAgo(1));
  // Older than 4 days -> hidden from institutions by the freshness rule (TF-03).
  await offer(coop, 'Joghurt Nature', 'DAIRY_EGGS', 'CHILLED', 5, 1, 60, days(1, 7), days(2, 17), hoursAgo(5 * 24));

  // One pickup already planned and handed to Galliker (test connection).
  const bundled = [...apples.claims, ...pears.claims];
  const window = bundleWindow([apples.donation, pears.donation]);
  const order = await prisma.transportOrder.create({
    data: {
      donorId: migros.id, pickupStart: window.start, pickupEnd: window.end,
      gallikerStatus: 'SENT', gallikerReference: 'GLK-TEST-DEMO-001', gallikerSentAt: new Date(),
    },
  });
  await prisma.claim.updateMany({ where: { id: { in: bundled.map((c) => c.id) } }, data: { status: 'BUNDLED', transportOrderId: order.id } });

  console.log('seeded 9 offers, 7 reservations (one partial), 1 transport order with two stops');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
