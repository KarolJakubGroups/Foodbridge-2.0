/**
 * Seeds demo accounts and donations (idempotent). Run with `npm run seed`.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' }) });
const PASSWORD = 'password';

const ACCOUNTS = [
  { username: 'migros', role: 'DONOR', organizationName: 'Migros Genossenschaft Zürich', address: 'Limmatstrasse 152, 8005 Zürich' },
  { username: 'coop', role: 'DONOR', organizationName: 'Coop Verteilzentrale Dietikon', address: 'Riedstrasse 10, 8953 Dietikon' },
  { username: 'foodbank_zrh', role: 'FOODBANK', organizationName: 'Schweizer Tafel Abgabestelle Zürich', address: 'Hohlstrasse 400, 8048 Zürich' },
  { username: 'dispatcher_gt', role: 'DISPATCHER', organizationName: 'Galliker Transport AG', address: 'Kantonsstrasse 2, 6246 Altishofen' },
];

const days = (n: number, hour = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const dateIn = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: Record<string, { id: string; address: string }> = {};
  for (const a of ACCOUNTS) {
    const email = `${a.username}@demo.foodbridge.ch`;
    const u = await prisma.user.upsert({
      where: { username: a.username },
      update: {},
      create: { username: a.username, email, passwordHash, role: a.role, organizationName: a.organizationName, address: a.address },
    });
    users[a.username] = { id: u.id, address: u.address };
  }
  console.log('accounts ready:', Object.keys(users).join(', '));

  if ((await prisma.donation.count()) > 0) {
    console.log('donations already present; skipping data seed');
    return;
  }

  const { migros, coop, foodbank_zrh: foodbank } = users;
  const base = (donor: { id: string; address: string }, productName: string, category: string, temperatureRange: string, bestBeforeInDays: number,
    numberOfPallets: number, weightPerPallet: number, start: Date, end: Date, createdAt: Date, status: string) => ({
    donorId: donor.id, productName, category, temperatureRange, bestBeforeDate: dateIn(bestBeforeInDays), pickupAddress: donor.address,
    numberOfPallets, weightPerPallet, overlapStart: start, overlapEnd: end, createdAt, status,
  });

  const rows = [
    // Migros: Äpfel + Birnen overlap (-> one Galliker order), Orangen disjoint (-> second order)
    base(migros, 'Äpfel Gala', 'FRUIT_VEG', 'AMBIENT', 12, 1, 50, days(1), days(3), hoursAgo(1), 'CLAIMED'),
    base(migros, 'Birnen', 'FRUIT_VEG', 'AMBIENT', 10, 1, 30, days(2), days(4), hoursAgo(1), 'CLAIMED'),
    base(migros, 'Orangen', 'FRUIT_VEG', 'AMBIENT', 14, 1, 40, days(4), days(5), hoursAgo(1), 'CLAIMED'),
    base(migros, 'Brot vom Vortag', 'BAKERY', 'AMBIENT', 2, 1, 20, days(1), days(2), hoursAgo(3), 'AVAILABLE'),
    // Coop
    base(coop, 'Bananen', 'FRUIT_VEG', 'CHILLED', 6, 1, 30, days(1), days(4), hoursAgo(24), 'CLAIMED'),
    base(coop, 'Milch UHT 1l', 'DAIRY_EGGS', 'CHILLED', 20, 2, 50, days(1), days(5), hoursAgo(6), 'AVAILABLE'),
    base(coop, 'Tiefkühl-Gemüse', 'FRUIT_VEG', 'FROZEN', 90, 1, 250, days(2), days(3), hoursAgo(1), 'AVAILABLE'),
    // Older than 4 days -> hidden from foodbanks by the freshness rule (TF-03)
    base(coop, 'Joghurt Nature', 'DAIRY_EGGS', 'CHILLED', 5, 1, 60, days(1), days(2), hoursAgo(5 * 24), 'AVAILABLE'),
  ];
  let claims = 0;
  for (const row of rows) {
    const d = await prisma.donation.create({ data: row });
    if (row.status === 'CLAIMED') {
      await prisma.claim.create({ data: { donationId: d.id, foodbankId: foodbank.id, claimedAt: hoursAgo(2) } });
      claims++;
    }
  }
  await prisma.wishlist.createMany({
    data: [
      { foodbankId: foodbank.id, productName: 'Reis', quantityKg: 200, note: 'Langkornreis, ambient', createdAt: hoursAgo(24) },
      { foodbankId: foodbank.id, productName: 'Milchprodukte', quantityKg: 100, note: 'Joghurt, Käse (gekühlt)', createdAt: hoursAgo(5) },
    ],
  });
  console.log(`seeded ${rows.length} donations, ${claims} claims, 2 wishlist entries`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
