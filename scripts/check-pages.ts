/**
 * Smoke test of the rendered pages against a running dev/prod server and the seeded database.
 * Creates sessions directly in the database (same mechanism as lib/session.ts).
 *   npx tsx --env-file=.env scripts/check-pages.ts [http://localhost:3000]
 */
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const base = process.argv[2] ?? 'http://localhost:3000';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function cookieFor(username: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { id: createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
  return `fb_session=${token}`;
}

let failures = 0;
async function check(label: string, path: string, cookie: string | null, expectStatus: number, mustContain: string[] = [], mustNotContain: string[] = [], expectLocation?: string) {
  const res = await fetch(base + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const body = await res.text();
  const missing = mustContain.filter((s) => !body.includes(s));
  const present = mustNotContain.filter((s) => body.includes(s));
  const location = res.headers.get('location') ?? '';
  const locOk = expectLocation ? location.endsWith(expectLocation) : true;
  const ok = res.status === expectStatus && missing.length === 0 && present.length === 0 && locOk;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${path} -> ${res.status}${location ? ' ' + location : ''}${missing.length ? ' missing: ' + missing.join(', ') : ''}${present.length ? ' unexpected: ' + present.join(', ') : ''}`);
}

async function main() {
const [migros, foodbank, dispatcher] = await Promise.all([cookieFor('migros'), cookieFor('foodbank_zrh'), cookieFor('dispatcher_gt')]);

await check('anonymous is redirected', '/donor', null, 307, [], [], '/login');
await check('login page renders', '/login', null, 200, ['Anmeldung FoodBridge 2.0', 'foodbank_zrh']);
await check('donor dashboard', '/donor', migros, 200, ['Spender-Verwaltung: MIGROS', 'Neues Angebot registrieren', 'Äpfel Gala', 'CO₂-Einsparung']);
await check('donor cannot open foodbank view', '/foodbank', migros, 307, [], [], '/donor');
await check('foodbank dashboard hides stale donation (TF-03)', '/foodbank', foodbank, 200, ['Abgabestelle Allokation: FOODBANK_ZRH', 'Milch UHT 1l'], ['Joghurt Nature']);
await check('dispatcher dashboard', '/dispatcher', dispatcher, 200, ['Galliker Logistik-Konsolidierungszentrum', 'Schnittmengenberechnung starten']);
await check('network view', '/network', foodbank, 200, ['Logistik-Netzwerk', 'Gerettetes Gewicht']);
await check('wishlist view', '/wishlist', migros, 200, ['Bedarfsanforderungen sozialer Institutionen', 'Reis']);
await check('logged-in user skips login', '/login', migros, 307, [], [], '/');
await check('bogus cookie is rejected', '/donor', 'fb_session=nope', 307, [], [], '/login');

await prisma.$disconnect();
console.log(failures === 0 ? '\nAll page checks passed.' : `\n${failures} page check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
