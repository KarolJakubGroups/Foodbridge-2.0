-- Pallets of one offer may weigh differently; the needs list ("Gesuchte Produkte") is removed.
-- Hand-written so existing rows are converted instead of dropped:
--   * every pallet of an existing offer gets the old weight per pallet
--   * existing reservations take the pallets in order (first claim pallets 1..n, the next one the following)

-- -------------------------------------------------------------- Donation
ALTER TABLE "Donation" ADD COLUMN "palletWeights" DOUBLE PRECISION[];
UPDATE "Donation" SET "palletWeights" = array_fill("weightPerPallet", ARRAY["numberOfPallets"]);
ALTER TABLE "Donation" ALTER COLUMN "palletWeights" SET NOT NULL;
ALTER TABLE "Donation" DROP COLUMN "weightPerPallet";
-- One weight per pallet, never more or fewer. Enforced by the database.
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_palletWeights_count" CHECK (cardinality("palletWeights") = "numberOfPallets");

-- ----------------------------------------------------------------- Claim
ALTER TABLE "Claim" ADD COLUMN "palletNumbers" INTEGER[],
ADD COLUMN "weightKg" DOUBLE PRECISION;

WITH ranked AS (
  SELECT c."id", c."pallets",
         COALESCE(SUM(c."pallets") OVER (PARTITION BY c."donationId" ORDER BY c."claimedAt", c."id"
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before
  FROM "Claim" c
)
UPDATE "Claim" c
SET "palletNumbers" = ARRAY(SELECT generate_series(r.before + 1, r.before + r."pallets")::INTEGER),
    "weightKg" = c."pallets" * d."palletWeights"[1]
FROM ranked r, "Donation" d
WHERE r."id" = c."id" AND d."id" = c."donationId";

ALTER TABLE "Claim" ALTER COLUMN "palletNumbers" SET NOT NULL,
ALTER COLUMN "weightKg" SET NOT NULL;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_palletNumbers_count" CHECK (cardinality("palletNumbers") = "pallets");

-- -------------------------------------------------------------- Wishlist
DROP TABLE "Wishlist";
