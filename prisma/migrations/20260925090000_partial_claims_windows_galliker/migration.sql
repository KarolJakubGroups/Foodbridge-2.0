-- Partial claims, pickup windows, Galliker hand-over and map coordinates.
-- Hand-written so existing rows are converted instead of dropped:
--   * every existing claim covers its whole donation (pallets = numberOfPallets)
--   * the logistics state moves from the donation to its claim
--   * a transport order's fixed pickupTime becomes the window its donations share

-- ------------------------------------------------------------------ User
ALTER TABLE "User" ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- ----------------------------------------------------------------- Claim
ALTER TABLE "Claim" ADD COLUMN     "pallets" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'RESERVED',
ADD COLUMN     "transportOrderId" INTEGER;

UPDATE "Claim" c
SET "pallets" = d."numberOfPallets",
    "status" = CASE d."status" WHEN 'BUNDLED' THEN 'BUNDLED' WHEN 'COMPLETED' THEN 'COMPLETED' ELSE 'RESERVED' END,
    "transportOrderId" = d."transportOrderId"
FROM "Donation" d
WHERE d."id" = c."donationId";

ALTER TABLE "Claim" ALTER COLUMN "pallets" SET NOT NULL;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_pallets_positive" CHECK ("pallets" > 0);

DROP INDEX "Claim_donationId_key";
CREATE INDEX "Claim_donationId_idx" ON "Claim"("donationId");
CREATE INDEX "Claim_transportOrderId_idx" ON "Claim"("transportOrderId");
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- -------------------------------------------------------- TransportOrder
ALTER TABLE "TransportOrder" ADD COLUMN     "gallikerError" TEXT,
ADD COLUMN     "gallikerReference" TEXT,
ADD COLUMN     "gallikerSentAt" TIMESTAMP(3),
ADD COLUMN     "gallikerStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN     "pickupEnd" TIMESTAMP(3),
ADD COLUMN     "pickupStart" TIMESTAMP(3),
ADD COLUMN     "routeComputedAt" TIMESTAMP(3),
ADD COLUMN     "routeDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "routeDurationMin" DOUBLE PRECISION,
ADD COLUMN     "routeGeometry" JSONB;

-- Window every donation of the order can be collected in. When a (manually
-- bundled) order has no common window, it collapses to the earliest end.
UPDATE "TransportOrder" o
SET "pickupEnd" = w.min_end,
    "pickupStart" = LEAST(w.max_start, w.min_end)
FROM (
  SELECT "transportOrderId" AS id, MAX("overlapStart") AS max_start, MIN("overlapEnd") AS min_end
  FROM "Donation" WHERE "transportOrderId" IS NOT NULL GROUP BY "transportOrderId"
) w
WHERE w.id = o."id";

-- Orders without donations (should not exist) keep their old fixed time.
UPDATE "TransportOrder" SET "pickupStart" = "pickupTime", "pickupEnd" = "pickupTime" WHERE "pickupStart" IS NULL;

ALTER TABLE "TransportOrder" ALTER COLUMN "pickupStart" SET NOT NULL,
ALTER COLUMN "pickupEnd" SET NOT NULL;
ALTER TABLE "TransportOrder" DROP COLUMN "pickupTime";

ALTER TABLE "Claim" ADD CONSTRAINT "Claim_transportOrderId_fkey" FOREIGN KEY ("transportOrderId") REFERENCES "TransportOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -------------------------------------------------------------- Donation
ALTER TABLE "Donation" ADD COLUMN     "claimedPallets" INTEGER NOT NULL DEFAULT 0;

UPDATE "Donation" d
SET "claimedPallets" = COALESCE((SELECT SUM(c."pallets") FROM "Claim" c WHERE c."donationId" = d."id"), 0);

-- CLAIMED now means "fully reserved"; bundled/collected state lives on the claims.
UPDATE "Donation" SET "status" = 'CLAIMED' WHERE "status" IN ('BUNDLED', 'COMPLETED');

-- Never more reserved than offered, never negative. Enforced by the database.
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_claimedPallets_range" CHECK ("claimedPallets" >= 0 AND "claimedPallets" <= "numberOfPallets");

ALTER TABLE "Donation" DROP CONSTRAINT "Donation_transportOrderId_fkey";
DROP INDEX "Donation_transportOrderId_idx";
ALTER TABLE "Donation" DROP COLUMN "transportOrderId";

-- -------------------------------------------------- GallikerTransmission
CREATE TABLE "GallikerTransmission" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "endpoint" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GallikerTransmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GallikerTransmission_orderId_createdAt_idx" ON "GallikerTransmission"("orderId", "createdAt");

ALTER TABLE "GallikerTransmission" ADD CONSTRAINT "GallikerTransmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TransportOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
