-- The best-before date becomes optional: the pickup window decides when goods can be collected.
ALTER TABLE "Donation" ALTER COLUMN "bestBeforeDate" DROP NOT NULL;
