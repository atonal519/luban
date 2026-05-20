-- CreateTable (IF NOT EXISTS for idempotency on servers already db-pushed)
CREATE TABLE IF NOT EXISTS "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add milestoneId column to Item (if not exists)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so this may fail silently if already applied via db push.
-- In that case, mark this migration as applied: prisma migrate resolve --applied YYYYMMDD_add_milestone
ALTER TABLE "Item" ADD COLUMN "milestoneId" TEXT REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
