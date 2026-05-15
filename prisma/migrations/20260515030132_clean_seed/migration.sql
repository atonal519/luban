-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "natureId" TEXT,
    "statusId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'T1',
    "versionNo" TEXT NOT NULL DEFAULT '',
    "applicationScope" TEXT NOT NULL DEFAULT '',
    "stageType" TEXT NOT NULL DEFAULT '',
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "parallelGroup" TEXT NOT NULL DEFAULT '',
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "mokraMotivation" TEXT NOT NULL DEFAULT '',
    "mokraObjects" TEXT NOT NULL DEFAULT '',
    "mokraKeyResults" TEXT NOT NULL DEFAULT '',
    "mokraActions" TEXT NOT NULL DEFAULT '',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "Nature" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StatusDef" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("actualEnd", "actualStart", "applicationScope", "createdAt", "createdById", "depth", "description", "id", "isParallel", "mokraActions", "mokraKeyResults", "mokraMotivation", "mokraObjects", "natureId", "order", "ownerId", "parallelGroup", "parentId", "plannedEnd", "plannedStart", "priority", "progress", "requiresApproval", "stageType", "statusId", "title", "updatedAt", "versionNo") SELECT "actualEnd", "actualStart", "applicationScope", "createdAt", "createdById", "depth", "description", "id", "isParallel", "mokraActions", "mokraKeyResults", "mokraMotivation", "mokraObjects", "natureId", "order", "ownerId", "parallelGroup", "parentId", "plannedEnd", "plannedStart", "priority", "progress", "requiresApproval", "stageType", "statusId", "title", "updatedAt", "versionNo" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");
CREATE INDEX "Item_stageType_idx" ON "Item"("stageType");
CREATE INDEX "Item_versionNo_idx" ON "Item"("versionNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
