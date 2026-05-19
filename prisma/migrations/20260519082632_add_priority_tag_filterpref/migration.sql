-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserFilterPref" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "filterKey" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserFilterPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorityDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'NODE',
    "stageFrom" TEXT NOT NULL DEFAULT '',
    "stageTo" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'WAITING_SUBMIT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Approval" ("createdAt", "id", "itemId", "state", "updatedAt") SELECT "createdAt", "id", "itemId", "state", "updatedAt" FROM "Approval";
DROP TABLE "Approval";
ALTER TABLE "new_Approval" RENAME TO "Approval";
CREATE INDEX "Approval_itemId_idx" ON "Approval"("itemId");
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
    "priorityId" TEXT,
    "versionNo" TEXT NOT NULL DEFAULT '',
    "applicationScope" TEXT NOT NULL DEFAULT '',
    "focus" TEXT NOT NULL DEFAULT '',
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
    "tagId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "Nature" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StatusDef" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "PriorityDef" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("actualEnd", "actualStart", "applicationScope", "createdAt", "createdById", "depth", "description", "id", "isParallel", "mokraActions", "mokraKeyResults", "mokraMotivation", "mokraObjects", "natureId", "order", "ownerId", "parallelGroup", "parentId", "plannedEnd", "plannedStart", "progress", "requiresApproval", "stageType", "statusId", "title", "updatedAt", "versionNo") SELECT "actualEnd", "actualStart", "applicationScope", "createdAt", "createdById", "depth", "description", "id", "isParallel", "mokraActions", "mokraKeyResults", "mokraMotivation", "mokraObjects", "natureId", "order", "ownerId", "parallelGroup", "parentId", "plannedEnd", "plannedStart", "progress", "requiresApproval", "stageType", "statusId", "title", "updatedAt", "versionNo" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");
CREATE INDEX "Item_stageType_idx" ON "Item"("stageType");
CREATE INDEX "Item_versionNo_idx" ON "Item"("versionNo");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DEV',
    "avatarSeed" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatarSeed", "createdAt", "email", "id", "name", "password", "role", "updatedAt") SELECT "avatarSeed", "createdAt", "email", "id", "name", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserFilterPref_userId_filterKey_key" ON "UserFilterPref"("userId", "filterKey");

-- CreateIndex
CREATE UNIQUE INDEX "PriorityDef_code_key" ON "PriorityDef"("code");

