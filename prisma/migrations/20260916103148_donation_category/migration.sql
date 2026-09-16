-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Donation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "donorId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "temperatureRange" TEXT NOT NULL,
    "bestBeforeDate" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "numberOfPallets" INTEGER NOT NULL,
    "weightPerPallet" REAL NOT NULL,
    "overlapStart" DATETIME NOT NULL,
    "overlapEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "transportOrderId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Donation_transportOrderId_fkey" FOREIGN KEY ("transportOrderId") REFERENCES "TransportOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Donation" ("bestBeforeDate", "createdAt", "donorId", "id", "numberOfPallets", "overlapEnd", "overlapStart", "pickupAddress", "productName", "status", "temperatureRange", "transportOrderId", "weightPerPallet") SELECT "bestBeforeDate", "createdAt", "donorId", "id", "numberOfPallets", "overlapEnd", "overlapStart", "pickupAddress", "productName", "status", "temperatureRange", "transportOrderId", "weightPerPallet" FROM "Donation";
DROP TABLE "Donation";
ALTER TABLE "new_Donation" RENAME TO "Donation";
CREATE INDEX "Donation_status_createdAt_idx" ON "Donation"("status", "createdAt");
CREATE INDEX "Donation_donorId_createdAt_idx" ON "Donation"("donorId", "createdAt");
CREATE INDEX "Donation_transportOrderId_idx" ON "Donation"("transportOrderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
