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
  return cookieForId(user.id);
}
async function cookieForId(userId: string): Promise<string> {
  const user = { id: userId };
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
await check('login page renders', '/login', null, 200, ['Anmelden', 'Demo-Konten']);
await check('donor dashboard', '/donor', migros, 200,
  ['Migros Genossenschaft Zürich', 'Überschuss melden', 'Meine Angebote', 'Äpfel Gala', 'Ihre Wirkung'],
  // the raw statuses may appear in serialized props, but must never be rendered as text
  ['>AVAILABLE<', '>CLAIMED<', '>BUNDLED<']);
await check('donor cannot open foodbank view', '/foodbank', migros, 307, [], [], '/donor');
await check('foodbank sees offers with countdown, hides stale ones (TF-03)', '/foodbank', foodbank, 200,
  ['Verfügbare Lebensmittel', 'Milch UHT 1l', 'reservierbar', 'Meine Reservierungen'], ['Joghurt Nature']);
await check('dispatcher board', '/dispatcher', dispatcher, 200, ['Transporte planen', 'Vorschlag erstellen', 'Abholfenster', 'Karte ansehen']);
await check('dispatcher map', '/dispatcher/map', dispatcher, 200, ['Karte', 'Abholadressen']);
await check('map is for dispatchers only', '/dispatcher/map', foodbank, 307, [], [], '/foodbank');
await check('network view for foodbank', '/network', foodbank, 200, ['Meine Lieferungen']);
await check('network view for dispatcher is national', '/network', dispatcher, 200, ['Alle Fahrten in der Schweiz']);
await check('network view for donor shows only own data', '/network', migros, 200, ['Meine Transporte'], ['Riedstrasse 10', 'Coop Verteilzentrale']);
await check('needs list is gone', '/wishlist', migros, 404, []);
await check('profile for foodbank asks who they are', '/profile', foodbank, 200, ['Kontaktperson', 'Wer wir sind']);
await check('profile for donor has no description', '/profile', migros, 200, ['Kontaktperson'], ['Wer wir sind']);
await check('logged-in user skips login', '/login', migros, 307, [], [], '/');
await check('bogus cookie is rejected', '/donor', 'fb_session=nope', 307, [], [], '/login');
await check('registration page is public', '/register', null, 200, ['Als Spender registrieren', 'Registrierung beantragen']);
await check('applications tab for foodbank', '/applications', foodbank, 200, ['Spender-Anträge']);
await check('applications tab hidden from donors', '/applications', migros, 307, [], [], '/donor');
await check('unknown page shows the 404 page', '/gibt-es-nicht', migros, 404, ['Seite nicht gefunden']);

// A pending donor sees the notice instead of the dashboard, and no navigation.
const pendingUser = await prisma.user.upsert({
  where: { email: 'pending.check@example.ch' }, update: { status: 'PENDING' },
  create: { username: 'pending_check', email: 'pending.check@example.ch', passwordHash: 'x', role: 'DONOR', status: 'PENDING', organizationName: 'Check AG', address: 'Teststrasse 1, 8000 Zürich' },
});
const pendingCookie = await cookieForId(pendingUser.id);
await check('pending donor is sent to /pending', '/donor', pendingCookie, 307, [], [], '/pending');
await check('pending donor sees review notice', '/pending', pendingCookie, 200, ['Check AG'], ['Überschuss melden', 'Meine Transporte']);
await check('verified donor skips /pending', '/pending', migros, 307, [], [], '/donor');
await prisma.session.deleteMany({ where: { userId: pendingUser.id } });
await prisma.user.delete({ where: { id: pendingUser.id } });

await prisma.$disconnect();
console.log(failures === 0 ? '\nAll page checks passed.' : `\n${failures} page check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
