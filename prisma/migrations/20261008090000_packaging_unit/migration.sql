-- How the goods are packed (e.g. "Karton à 12 × 1 l"); optional, so existing offers stay valid.
ALTER TABLE "Donation" ADD COLUMN "packagingUnit" TEXT;
