-- S3: recepción acoplada — AssemblyOrder.batteryConfigurationId + Battery.assemblyOrderId

ALTER TABLE "AssemblyOrder"
  ADD COLUMN "batteryConfigurationId" TEXT;

ALTER TABLE "AssemblyOrder"
  ADD CONSTRAINT "AssemblyOrder_batteryConfigurationId_fkey"
  FOREIGN KEY ("batteryConfigurationId") REFERENCES "BatteryConfiguration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Battery"
  ADD COLUMN "assemblyOrderId" TEXT;

ALTER TABLE "Battery"
  ADD CONSTRAINT "Battery_assemblyOrderId_fkey"
  FOREIGN KEY ("assemblyOrderId") REFERENCES "AssemblyOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Battery_assemblyOrderId_idx" ON "Battery"("assemblyOrderId");
