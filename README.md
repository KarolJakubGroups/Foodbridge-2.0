# FoodBridge 2.0

B2B-Plattform der Stiftung Schweizer Tafel zur Lebensmittelrettung und Logistik-Konsolidierung.
Detailhändler (Spender) erfassen überschüssige Lebensmittel, soziale Institutionen (Abgabestellen)
beanspruchen sie, und ein Intervall-Scheduling-Algorithmus bündelt überlappende Abholfenster zu
Transportaufträgen für Galliker Logistics.

Die Anwendung ist vollständig eigenständig: kein Cloud-Account, keine externen Dienste. Sie läuft mit
einer lokalen SQLite-Datei und lässt sich über Prisma auf PostgreSQL umstellen.

## Tech Stack

- **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript, Tailwind CSS 4
- **Prisma 7** mit **SQLite** (lokal) – Datenbankschema in `prisma/schema.prisma`, Migrationen in `prisma/migrations`
- Eigene Session-Authentifizierung (bcrypt-Passwörter, HttpOnly-Cookie, Sessions in der DB)
- **Vitest** für Unit- und Integrationstests

## Schnellstart

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run setup     # Migrationen einspielen, Prisma-Client generieren, Demo-Daten anlegen
npm run dev       # http://localhost:3000
```

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
| Wirkungsbilanz | `lib/impact.ts`: kg = Paletten × Gewicht, 2 Mahlzeiten/kg, 1.1 kg CO₂e/kg |

## Skripte

```bash
npm run dev          # Entwicklungsserver
npm run build        # Produktions-Build (generiert vorher den Prisma-Client)
npm start            # Produktionsserver
npm test             # Unit- und Integrationstests (eigene Test-DB prisma/test.db)
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run setup        # Migrationen + Client + Seed (Erstinstallation)
npm run seed         # Demo-Daten anlegen (idempotent)
npm run db:reset     # Datenbank neu aufsetzen, danach `npm run seed`
npm run db:studio    # Prisma Studio zum Durchsehen der Daten
```

Smoke-Test der gerenderten Seiten gegen einen laufenden Server: `npx tsx scripts/check-pages.ts`.

## Auf PostgreSQL umstellen

1. In `prisma/schema.prisma` `provider = "postgresql"` setzen.
2. `DATABASE_URL` als Umgebungsvariable setzen (z. B. in `.env`).
3. In `lib/db.ts` und `prisma/seed.ts` den Adapter `@prisma/adapter-better-sqlite3` durch `@prisma/adapter-pg` ersetzen.
4. `npx prisma migrate dev --name init` ausführen (neue Migrationen für Postgres erzeugen).

## Projektstruktur

```
app/
  login/               Anmeldung
  (app)/               eingeloggter Bereich mit Header/Navigation
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
  db.ts                Prisma-Client (SQLite-Adapter)
prisma/                Schema, Migrationen, Seed, lokale Datenbank (dev.db, nicht versioniert)
proxy.ts               Optimistische Login-Umleitung (Next.js Proxy, früher Middleware)
tests/                 Integrationstests der Geschäftsregeln
scripts/check-pages.ts Smoke-Test der Seiten
legacy/                frühere Spring-Boot-Implementierung (kann gelöscht werden)
```
