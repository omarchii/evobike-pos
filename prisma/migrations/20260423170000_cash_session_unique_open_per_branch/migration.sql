-- Enforces a nivel BD el invariante "máximo 1 sesión OPEN por sucursal".
-- Sin este índice la validación en la app no tiene red de seguridad si dos
-- requests concurrentes pasan el check y ambos crean una sesión.
--
-- Pre-migración (Paso 1 del procedure): verificado 0 duplicados en dev antes
-- de aplicar. En prod hay que correr la detección primero y cerrar sintético
-- cualquier huérfana según el procedure documentado en la memoria del brief.

CREATE UNIQUE INDEX "unique_open_session_per_branch"
  ON "CashRegisterSession" ("branchId")
  WHERE status = 'OPEN';
