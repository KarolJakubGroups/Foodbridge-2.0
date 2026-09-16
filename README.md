# FoodBridge 2.0

B2B-Plattform der Stiftung Schweizer Tafel zur Lebensmittelrettung und Logistik-Konsolidierung.
Detailhändler (Spender) erfassen überschüssige Lebensmittel, soziale Institutionen (Empfänger)
beanspruchen sie, und ein Intervall-Scheduling-Algorithmus bündelt überlappende Abholfenster zu
Transportaufträgen für Galliker Logistics.

## Tech Stack

- **Backend:** Java 17, Spring Boot 3.5, Spring Data JPA, H2 In-Memory-Datenbank, REST-API
- **Frontend:** React 18 (in-browser Babel), Tailwind CSS, Slate-ERP-Stil; wird statisch von Spring Boot ausgeliefert
- **Build:** Maven

## Starten

```bash
mvn clean package -DskipTests
java -jar target/foodbridge-0.0.1-SNAPSHOT.jar
```

Anschliessend <http://localhost:8085/> im Browser öffnen. Die H2-Konsole ist unter
<http://localhost:8085/h2-console> erreichbar (JDBC-URL `jdbc:h2:mem:foodbridge`, User `sa`, kein Passwort).

Tests ausführen:

```bash
mvn test
```

## Test-Accounts (Passwort: `password`)

| Kennung         | Rolle      | Organisation                        |
|-----------------|------------|-------------------------------------|
| `migros`        | DONOR      | Migros Genossenschaft Zürich        |
| `coop`          | DONOR      | Coop Verteilzentrale Dietikon       |
| `foodbank_zrh`  | FOODBANK   | Schweizer Tafel Abgabestelle Zürich |
| `dispatcher_gt` | DISPATCHER | Galliker Transport AG               |

Der `DatabaseLoader` befüllt die Datenbank bei jedem Start mit Demo-Daten, inklusive einer
5 Tage alten Spende, die durch die 4-Tage-Frist ausgeblendet wird.

## Fachliche Regeln

- **7 Pflichtfelder** pro Spende: Produktname, Temperaturbereich, MHD, Abholadresse, Anzahl Paletten,
  Gewicht pro Palette, Abholzeitfenster (Beginn/Ende). Validierung im Backend (`DonationRequest`) und im Formular.
- **4-Tage-Frist:** Spenden, deren `createdAt` älter als 4 Tage ist, erscheinen nicht unter
  `/api/donations/available` und werden beim Claim serverseitig mit HTTP 409 abgewiesen (`FreshnessPolicy`).
- **Galliker-Bündelung** (`LogisticsService`): beanspruchte Spenden desselben Spenders werden nach
  Fensterende sortiert. Jede Spende, deren Beginn `<=` dem Referenzende des aktuellen Bündels liegt, wird
  aufgenommen; sonst startet ein neues Bündel. Abholtermin ist 12:00 Uhr am Schnittpunkt-Tag.
- **Impact:** gerettete kg = Paletten × Gewicht/Palette; 2 Mahlzeiten/kg; 1.1 kg CO₂e/kg.

## REST-API

| Methode | Pfad                                | Beschreibung                                  |
|---------|-------------------------------------|-----------------------------------------------|
| POST    | `/api/auth/login`                   | Anmeldung, liefert Benutzer mit Rolle         |
| GET     | `/api/auth/accounts`                | Demo-Accounts für Schnellauswahl              |
| POST    | `/api/donations`                    | Spende erfassen (7 Pflichtfelder)             |
| GET     | `/api/donations/available`          | Frische, verfügbare Spenden (4-Tage-Filter)   |
| GET     | `/api/donations/donor/{id}`         | Spenden eines Spenders                        |
| GET     | `/api/donations`                    | Alle Spenden                                  |
| POST    | `/api/claims`                       | Spende beanspruchen                           |
| GET     | `/api/claims/foodbank/{id}`         | Claims einer Institution                      |
| POST    | `/api/logistics/bundle`             | Bündelung ausführen, neue Transportaufträge   |
| GET     | `/api/logistics/orders`             | Alle Transportaufträge                        |
| PATCH   | `/api/logistics/orders/{id}/status` | Status PENDING → DISPATCHED → COMPLETED       |
| PATCH   | `/api/logistics/orders/{id}/driver` | Fahrer zuweisen                               |
| GET     | `/api/impact`                       | Globale Wirkungsbilanz                        |
| GET     | `/api/impact/donor/{id}`            | Wirkungsbilanz eines Spenders                 |
| GET     | `/api/impact/foodbank/{id}`         | Wirkungsbilanz einer Institution              |
| GET/POST/DELETE | `/api/wishlists`            | Bedarfsanforderungen sozialer Institutionen   |

## Projektstruktur

```
src/main/java/ch/schweizertafel/foodbridge
├── controller   REST-Endpunkte (Presentation Layer)
├── service      Geschäftslogik: Donation, Claim, Logistics, Impact, Wishlist
├── repository   Spring Data JPA Repositories
├── model        JPA-Entitäten: User, Donation, Claim, TransportOrder, Wishlist
├── dto          Request/Response-Records mit Validierung
└── config       DatabaseLoader (Seed), GlobalExceptionHandler
src/main/resources/static   index.html + app.js (React SPA)
```
