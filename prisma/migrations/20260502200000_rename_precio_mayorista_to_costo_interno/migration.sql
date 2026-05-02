-- INT-9: rename precioMayorista → costoInterno (semantic, no functional change)
ALTER TABLE "SimpleProduct" RENAME COLUMN "precioMayorista" TO "costoInterno";
