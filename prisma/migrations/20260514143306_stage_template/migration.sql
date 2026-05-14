-- CreateTable
CREATE TABLE "StageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "parallelGroup" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "StageTemplate_stageGroupId_fkey" FOREIGN KEY ("stageGroupId") REFERENCES "StageGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StageTemplate_stageGroupId_idx" ON "StageTemplate"("stageGroupId");
