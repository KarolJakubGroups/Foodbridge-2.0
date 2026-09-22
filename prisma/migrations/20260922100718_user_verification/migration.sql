-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Existing accounts (seeded demo users) are already verified.
UPDATE "User" SET "status" = 'APPROVED', "reviewedAt" = CURRENT_TIMESTAMP WHERE "role" = 'DONOR';
