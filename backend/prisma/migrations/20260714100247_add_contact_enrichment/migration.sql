-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "domain" TEXT,
    "isFreeEmail" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "title" TEXT,
    "company" TEXT,
    "companyDomain" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "socialProfiles" JSONB,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "matchStatus" TEXT NOT NULL DEFAULT 'unknown',
    "sources" JSONB,
    "provider" TEXT,
    "raw" JSONB,
    "enrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MeetingAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "linkedinUrl" TEXT,
    "company" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "enrichedAt" DATETIME,
    "contactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingAttendee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MeetingAttendee" ("bio", "company", "createdAt", "email", "enrichedAt", "id", "linkedinUrl", "meetingId", "name", "role", "title", "updatedAt") SELECT "bio", "company", "createdAt", "email", "enrichedAt", "id", "linkedinUrl", "meetingId", "name", "role", "title", "updatedAt" FROM "MeetingAttendee";
DROP TABLE "MeetingAttendee";
ALTER TABLE "new_MeetingAttendee" RENAME TO "MeetingAttendee";
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");
CREATE INDEX "MeetingAttendee_email_idx" ON "MeetingAttendee"("email");
CREATE INDEX "MeetingAttendee_contactId_idx" ON "MeetingAttendee"("contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_domain_idx" ON "Contact"("domain");
