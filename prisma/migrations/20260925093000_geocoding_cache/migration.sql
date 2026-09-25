-- AlterTable
ALTER TABLE "User" DROP COLUMN "geocodedAt",
DROP COLUMN "latitude",
DROP COLUMN "longitude";

-- CreateTable
CREATE TABLE "GeocodedAddress" (
    "query" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "displayName" TEXT,
    "lookedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodedAddress_pkey" PRIMARY KEY ("query")
);

