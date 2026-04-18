-- CreateIndex
CREATE INDEX "ServiceOrderApproval_status_requestedAt_idx" ON "ServiceOrderApproval"("status", "requestedAt");
