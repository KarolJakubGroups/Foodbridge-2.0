-- What the pallets are made of (EURO | DISPOSABLE | PLASTIC | OTHER). Existing offers stay NULL = unknown.
ALTER TABLE "Donation" ADD COLUMN "palletMaterial" TEXT;
