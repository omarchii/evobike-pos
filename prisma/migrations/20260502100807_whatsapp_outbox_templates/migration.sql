-- CreateEnum
CREATE TYPE "OutboundMessageStatus" AS ENUM ('PENDING', 'OPENED_IN_WAME', 'EXPIRED', 'CANCELLED', 'ERROR');

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "requiredVariables" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "customerId" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" "OutboundMessageStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "cancelReason" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundMessage_status_scheduledAt_idx" ON "OutboundMessage"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "OutboundMessage_customerId_status_idx" ON "OutboundMessage"("customerId", "status");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_expiresAt_idx" ON "OutboundMessage"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_templateKey_fkey" FOREIGN KEY ("templateKey") REFERENCES "WhatsAppTemplate"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
