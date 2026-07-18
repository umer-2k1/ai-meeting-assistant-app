-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "audioUrl" TEXT,
    "audioDuration" INTEGER,
    "recordingStarted" DATETIME,
    "recordingEnded" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "calendarEventId" TEXT,
    "platform" TEXT,
    "platformMeetingId" TEXT,
    "platformUrl" TEXT,
    "aiSummary" TEXT,
    "summaryHtml" TEXT,
    "keyDecisions" TEXT NOT NULL DEFAULT '[]',
    "risks" TEXT NOT NULL DEFAULT '[]',
    "highlights" TEXT NOT NULL DEFAULT '[]',
    "processingError" TEXT,
    "embeddingId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("aiSummary", "audioDuration", "audioUrl", "createdAt", "description", "duration", "embeddingId", "endTime", "highlights", "id", "keyDecisions", "platform", "platformMeetingId", "platformUrl", "processingError", "recordingEnded", "recordingStarted", "risks", "startTime", "status", "summaryHtml", "title", "updatedAt", "userId") SELECT "aiSummary", "audioDuration", "audioUrl", "createdAt", "description", "duration", "embeddingId", "endTime", "highlights", "id", "keyDecisions", "platform", "platformMeetingId", "platformUrl", "processingError", "recordingEnded", "recordingStarted", "risks", "startTime", "status", "summaryHtml", "title", "updatedAt", "userId" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE UNIQUE INDEX "Meeting_embeddingId_key" ON "Meeting"("embeddingId");
CREATE INDEX "Meeting_userId_idx" ON "Meeting"("userId");
CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX "Meeting_source_idx" ON "Meeting"("source");
CREATE INDEX "Meeting_calendarEventId_idx" ON "Meeting"("calendarEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
