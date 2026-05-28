-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_CALENDAR', 'GMAIL', 'SLACK', 'MICROSOFT');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

-- CreateIndex
CREATE INDEX "Integration_provider_idx" ON "Integration"("provider");

-- CreateIndex
CREATE INDEX "Integration_isActive_idx" ON "Integration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_provider_key" ON "Integration"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
