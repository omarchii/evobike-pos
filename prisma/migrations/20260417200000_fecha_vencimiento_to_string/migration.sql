-- Convierte PurchaseReceipt.fechaVencimiento de TIMESTAMP(3) a TEXT ("YYYY-MM-DD").
--
-- Los valores existentes se persistieron como UTC medianoche del día capturado
-- por el operador (input <input type="date"> + z.coerce.date() interpreta
-- "YYYY-MM-DD" como UTC). Para recuperar el día original, extraemos en UTC.
ALTER TABLE "PurchaseReceipt"
  ALTER COLUMN "fechaVencimiento" TYPE TEXT
  USING TO_CHAR("fechaVencimiento" AT TIME ZONE 'UTC', 'YYYY-MM-DD');
