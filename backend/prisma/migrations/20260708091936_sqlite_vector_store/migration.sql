/*
  Warnings:

  - You are about to drop the column `qdrantId` on the `VectorEmbedding` table. All the data in the column will be lost.
  - Added the required column `pointId` to the `VectorEmbedding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vector` to the `VectorEmbedding` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VectorEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "vector" BLOB NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "meetingId" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gemini',
    "dimension" INTEGER NOT NULL DEFAULT 768,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- NOTE: old rows are intentionally NOT copied. Pre-migration VectorEmbedding
-- rows were only *pointers* into an external Qdrant instance (`qdrantId`); the
-- actual vector never lived in SQLite, so there is nothing to preserve and the
-- new `vector`/`pointId` NOT NULL columns can't be back-filled. Semantic search
-- self-heals: meetings re-index into the SQLite store as they are (re)processed,
-- and until then search falls back to keyword / full-transcript.
DROP TABLE "VectorEmbedding";
ALTER TABLE "new_VectorEmbedding" RENAME TO "VectorEmbedding";
CREATE UNIQUE INDEX "VectorEmbedding_pointId_key" ON "VectorEmbedding"("pointId");
CREATE INDEX "VectorEmbedding_entityType_entityId_idx" ON "VectorEmbedding"("entityType", "entityId");
CREATE INDEX "VectorEmbedding_pointId_idx" ON "VectorEmbedding"("pointId");
CREATE INDEX "VectorEmbedding_collectionName_meetingId_idx" ON "VectorEmbedding"("collectionName", "meetingId");
CREATE INDEX "VectorEmbedding_collectionName_userId_idx" ON "VectorEmbedding"("collectionName", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
