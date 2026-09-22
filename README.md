# FoodBridge 2.0

B2B-Plattform der Stiftung Schweizer Tafel zur Lebensmittelrettung und Logistik-Konsolidierung.
Detailhändler (Spender) erfassen überschüssige Lebensmittel, soziale Institutionen (Abgabestellen)
beanspruchen sie, und ein Intervall-Scheduling-Algorithmus bündelt überlappende Abholfenster zu
Transportaufträgen für Galliker Logistics.

Die Daten liegen in einer PostgreSQL-Datenbank auf Supabase; der Zugriff läuft über Prisma. Es wird
ausschliesslich die Datenbank von Supabase genutzt (kein Supabase Auth, keine Edge Functions), daher
lässt sich die Datenbank jederzeit auf ein anderes Supabase-Projekt oder einen beliebigen
PostgreSQL-Server umziehen: nur `DATABASE_URL` ändern und `npm run setup` ausführen.

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript, Tailwind CSS 4
- **Prisma 7** mit **PostgreSQL (Supabase)** – Datenbankschema in `prisma/schema.prisma`, Migrationen in `prisma/migrations`
- Eigene Session-Authentifizierung (bcrypt-Passwörter, HttpOnly-Cookie, Sessions in der DB)
- **Vitest** für Unit- und Integrationstests

## Schnellstart

Voraussetzungen: Node.js 22 oder neuer und ein Supabase-Projekt (oder eine andere PostgreSQL-Datenbank).

```bash
npm install
cp .env.example .env   # DATABASE_URL eintragen: Supabase -> Connect -> "Session pooler"
npm run setup          # Migrationen einspielen, Prisma-Client generieren, Demo-Daten anlegen
npm run dev            # http://localhost:3000
```

Verbindungsstring: im Supabase-Dashboard oben auf **Connect** klicken, Methode **Session pooler**
wählen und den String mit dem Datenbank-Passwort in `.env` als `DATABASE_URL` eintragen. Der Session
pooler (Port 5432) ist IPv4-fähig und unterstützt Transaktionen, die die Geschäftslogik benötigt.

Für einen Produktionslauf: `npm run build && npm start`.

## Demo-Accounts (Passwort: `password`)

| E-Mail                              | Rolle      | Organisation                        |
|-------------------------------------|------------|-------------------------------------|
| `migros@demo.foodbridge.ch`         | DONOR      | Migros Genossenschaft Zürich        |
| `coop@demo.foodbridge.ch`           | DONOR      | Coop Verteilzentrale Dietikon       |
| `foodbank_zrh@demo.foodbridge.ch`   | FOODBANK   | Schweizer Tafel Abgabestelle Zürich |
| `dispatcher_gt@demo.foodbridge.ch`  | DISPATCHER | Galliker Transport AG               |

Die Login-Seite hat Schnellauswahl-Buttons für diese Accounts. Der Seed enthält eine 5 Tage alte
Spende, die durch die 4-Tage-Frist für Abgabestellen unsichtbar bleibt.

**Registrierung neuer Spender:** Unternehmen registrieren sich selbst unter `/register`. Das Konto ist zunächst
`PENDING`: die Person kann sich anmelden, sieht aber nur einen Hinweis und kann keine Spenden erfassen. Die
Abgabestelle (`foodbank_zrh`) gibt Anträge im Tab **Anträge** frei oder lehnt sie ab. Es werden keine E-Mails
verschickt; Antragstellende melden sich später erneut an.

**Demo-Ablauf:** als `migros` eine Spende erfassen → als `foodbank_zrh` reservieren → als
`dispatcher_gt` „Schnittmengenberechnung starten“ → Auftrag disponieren und abschliessen →
Wirkungsbilanz unter „Logistik-Netzwerk“.

## Fachliche Regeln und wo sie leben

| Regel | Umsetzung |
|-------|-----------|
| 7 Pflichtfelder pro Spende + Warengruppe | `lib/services.ts` (`createDonation`), Formular `components/DonationForm.tsx`; Kategorien in `lib/domain.ts` |
| 4-Tage-Frist | Lesen: `fetchAvailableDonations` in `lib/queries.ts`; Schreiben: bedingtes `updateMany` in `claimDonation` |
| Nur eine Institution pro Spende | Atomares `updateMany … WHERE status = 'AVAILABLE'` in einer Transaktion, `UNIQUE` auf `Claim.donationId` |
| Galliker-Bündelung | Algorithmus in `lib/logistics.ts` (Sortierung nach Fensterende, `start <= bundleEnd`), Persistenz in `runBundling` |
| Abholtermin 12:00 Uhr | `zurichNoonOf` in `lib/domain.ts`: 12:00 Europe/Zurich des Schnittpunkt-Tages |
| Statusübergänge PENDING → DISPATCHED → COMPLETED | `setOrderStatus`; COMPLETED setzt auch die Spenden auf COMPLETED |
| Rollenrechte | Jede Service-Funktion prüft die Rolle; Seiten leiten fremde Rollen um (`lib/auth.ts`) |
| Spender-Verifizierung | `registerDonor` legt Konten als `PENDING` an; `reviewDonor` (nur FOODBANK) setzt `APPROVED`/`REJECTED`; `createDonation` verlangt `APPROVED`; `requireProfile` leitet Unverifizierte nach `/pending` |
| Wirkungsbilanz | `lib/impact.ts`: kg = Paletten × Gewicht, 2 Mahlzeiten/kg, 1.1 kg CO₂e/kg |

## Skripte

```bash
npm run dev          # Entwicklungsserver
npm run build        # Produktions-Build (generiert vorher den Prisma-Client)
npm start            # Produktionsserver
npm test             # Unit- und Integrationstests (eigenes Schema "foodbridge_test" in der Datenbank)
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run setup        # Migrationen + Client + Seed (Erstinstallation)
npm run seed         # Demo-Daten anlegen (idempotent)
npm run db:deploy    # ausstehende Migrationen einspielen (z. B. nach dem Wechsel der Datenbank)
npm run db:reset     # Datenbank leeren und neu aufsetzen (Seed läuft automatisch)
npm run db:studio    # Prisma Studio zum Durchsehen der Daten
```

Smoke-Test der gerenderten Seiten gegen einen laufenden Server: `npx tsx --env-file=.env scripts/check-pages.ts`.

## Datenbank übergeben oder umziehen

Das Supabase-Projekt kann im Dashboard an eine andere Organisation übertragen werden
(Project Settings → General → Transfer project). Alternativ genügt für einen Umzug auf einen anderen
PostgreSQL-Server ein neuer `DATABASE_URL` und `npm run setup`; das Schema wird durch die Migrationen
in `prisma/migrations` vollständig neu aufgebaut.

## Projektstruktur

```
app/
  login/               Anmeldung
  register/            Selbstregistrierung für Unternehmen
  (app)/               eingeloggter Bereich mit Header/Navigation
    pending/           Hinweis für noch nicht freigegebene Spender
    applications/      Anträge prüfen (nur Abgabestelle)
    donor/             Spender-Dashboard (Erfassung, Bestandsliste, Wirkungsbilanz)
    foodbank/          Abgabestellen-Dashboard (verfügbare Spenden, Reservierungen)
    dispatcher/        Disponenten-Ansicht (Bündelung, Transportaufträge, Status)
    network/           Logistik-Netzwerk und globale Wirkungsbilanz
    wishlist/          Bedarfsanforderungen
components/            UI-Bausteine und Client-Komponenten (Formulare, Buttons)
lib/
  actions.ts           Server Actions (Login, Spende, Claim, Bündelung, Status, Bedarf)
  services.ts          Geschäftslogik mit Transaktionen
  queries.ts           Lesezugriffe für Server Components
  session.ts, auth.ts  Sessions und Rollenprüfung
  logistics.ts         Intervall-Scheduling-Algorithmus
  impact.ts, domain.ts Wirkungsbilanz, Konstanten, Regeln
  db.ts                Prisma-Client (PostgreSQL-Adapter)
prisma/                Schema, Migrationen, Seed
proxy.ts               Optimistische Login-Umleitung (Next.js Proxy, früher Middleware)
tests/                 Integrationstests der Geschäftsregeln
scripts/check-pages.ts Smoke-Test der Seiten
legacy/                frühere Spring-Boot-Implementierung (kann gelöscht werden)
```
