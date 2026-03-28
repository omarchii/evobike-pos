# Catalog Redesign Phase 1B — Design Spec
**Date:** 2026-03-27
**Scope:** Schema migration, price model, product variant rename, seed update
**Approach:** Migración incremental en 5 pasos atómicos con rollback individual

---

## 1. Problema y Contexto

El esquema actual del catálogo de productos tiene limitaciones que bloquean requerimientos de negocio:

1. **Precio unico:** `ModeloConfiguracion.precio` solo almacena un precio (publico). No existe precio distribuidor, impidiendo ventas B2B y reportes de margen.
2. **Nombre ambiguo:** El campo `precio` no distingue entre precio publico y otros tipos de precio. Al agregar `precioDistribuidor`, el nombre `precio` se vuelve confuso.
3. **Nombre de modelo legacy:** `ModeloConfiguracion` es un nombre heredado del modelado inicial. El dominio real es "variante de producto" (`ProductVariant`), que es mas claro para nuevos desarrolladores y consistente con estandares de e-commerce.
4. **Sin imagen por modelo:** No hay campo para imagen del modelo base, necesario para el catalogo visual del POS.
5. **Sin voltaje en bicicleta de cliente:** `CustomerBike` no registra voltaje, dato util para diagnostico en taller.
6. **Server Actions con logica de negocio:** `sale.ts`, `inventory.ts` y `workshop.ts` en `src/actions/` contienen logica de negocio como Server Actions, contradiciendo la regla de CLAUDE.md que exige API Routes para mutaciones.

---

## 2. Requerimientos del Cliente

| # | Requerimiento | Prioridad |
|---|--------------|-----------|
| R1 | Agregar campo `imageUrl` al modelo base (`Modelo`) | Alta |
| R2 | Agregar `precioDistribuidor` a la variante de producto | Alta |
| R3 | Renombrar `precio` a `precioPublico` para claridad semantica | Alta |
| R4 | Agregar campo `voltaje` opcional a `CustomerBike` | Media |
| R5 | Renombrar model Prisma `ModeloConfiguracion` a `ProductVariant` | Alta |
| R6 | Hacer `precioDistribuidor` requerido una vez poblado con datos reales | Alta |

---

## 3. Decisiones de Diseno

### A. Imagen en Modelo, no en Variante

La imagen se agrega a `Modelo` (no a `ProductVariant`) porque visualmente todas las variantes de un modelo comparten la misma foto del producto. Si en el futuro se necesitan imagenes por variante, se puede agregar sin conflicto.

**Campo:** `imageUrl String?` en `Modelo`
**Migracion:** `ALTER TABLE ADD COLUMN`, nullable, sin impacto en datos existentes.

### B. Precio Distribuidor con Flag de Confirmacion

Se agrega `precioDistribuidor Decimal? @db.Decimal(10, 2)` como nullable inicialmente, con valor por defecto `= costo` como estimado. Se incluye un campo booleano `precioDistribuidorConfirmado Boolean @default(false)` para distinguir estimados de precios reales.

**Regla de UI:** Mientras `precioDistribuidorConfirmado == false`, la interfaz muestra un badge visible "Precio distribuidor pendiente" junto al precio. Esto previene que un vendedor confunda un estimado con un precio real aprobado.

**Paso final:** Una vez que el equipo confirme todos los precios distribuidor, una migracion posterior hace el campo `NOT NULL` y se puede retirar el flag (o conservarlo para futuros cambios de precio).

### C. Rename Atomico: `precio` + `ModeloConfiguracion` en un Solo Paso

El rename de `precio` a `precioPublico` y el rename del modelo `ModeloConfiguracion` a `ProductVariant` tocan los mismos 11+ archivos. Hacerlos por separado genera dos rondas de cambios en los mismos archivos con riesgo de conflictos y estado intermedio inconsistente.

**Decision:** Fusionar en un unico paso atomico:
- Una sola migracion Prisma (`rename-precio-and-product-variant`)
- Un solo commit
- Incluye actualizacion del seed (`prisma/seed.ts` y CSVs) como sub-paso obligatorio

### D. Voltaje en CustomerBike como Campo Opcional

`CustomerBike` recibe `voltage String?` (texto libre, ej. "48V", "60V") en lugar de FK a `Voltaje`, porque las bicicletas de clientes pueden ser de marcas externas con voltajes no catalogados.

### E. Server Actions: Deuda Tecnica Documentada (NO se refactorizan en esta fase)

**Decision explicita:** Los archivos `src/actions/sale.ts`, `src/actions/inventory.ts` y `src/actions/workshop.ts` contienen logica de negocio como Server Actions, lo cual contradice la regla de CLAUDE.md. Sin embargo, refactorizarlos a API Routes en esta fase seria:

1. **Scope creep:** La migracion de catalogo ya toca 15+ archivos. Agregar refactorizacion de 3 Server Actions con logica financiera critica aumenta riesgo.
2. **Ortogonal:** El rename de campos/modelos es un cambio mecanico. La refactorizacion de Server Actions a API Routes es un cambio arquitectonico que requiere testing independiente.
3. **Riesgo financiero:** `sale.ts` maneja transacciones de venta, inventario y caja. Un error en la refactorizacion puede causar perdida de datos financieros.

**Accion:** Se documenta como deuda tecnica para Fase 2. Los Server Actions se actualizan mecanicamente en esta fase (renombrar `modeloConfiguracion` a `productVariant`, `precio` a `precioPublico`) pero NO se mueven a API Routes.

**Deuda tecnica registrada:**
- `src/actions/sale.ts` — mover a `src/app/api/sales/route.ts`
- `src/actions/inventory.ts` — mover a `src/app/api/inventory/route.ts`
- `src/actions/workshop.ts` — mover a `src/app/api/workshop/route.ts`

---

## 4. Diagrama del Nuevo Esquema

```
model Modelo {
  id           String   @id @default(uuid())
  nombre       String   @unique
  descripcion  String?
  imageUrl     String?                          // NUEVO (Paso 1)
  requiere_vin Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  coloresDisponibles ModeloColor[]
  configuraciones    ProductVariant[]            // RENOMBRADO (Paso 3+5)
  commissionRules    CommissionRule[]
}

model ProductVariant {                           // RENOMBRADO desde ModeloConfiguracion (Paso 3+5)
  id         String  @id @default(uuid())
  modelo_id  String
  color_id   String
  voltaje_id String
  sku        String  @unique
  precioPublico              Decimal  @db.Decimal(10, 2)  // RENOMBRADO desde "precio" (Paso 3+5)
  costo                      Decimal  @db.Decimal(10, 2)
  precioDistribuidor         Decimal? @db.Decimal(10, 2)  // NUEVO (Paso 2), luego NOT NULL (Paso 5)
  precioDistribuidorConfirmado Boolean @default(false)     // NUEVO (Paso 2)
  imageUrl   String?

  modelo  Modelo  @relation(fields: [modelo_id], references: [id])
  color   Color   @relation(fields: [color_id], references: [id])
  voltaje Voltaje @relation(fields: [voltaje_id], references: [id])

  stocks             Stock[]
  saleItems          SaleItem[]
  serviceOrderItems  ServiceOrderItem[]
  inventoryMovements InventoryMovement[]

  @@unique([modelo_id, color_id, voltaje_id])
  @@map("ModeloConfiguracion")                   // Mantiene nombre de tabla en DB
}

model CustomerBike {
  id           String   @id @default(uuid())
  customerId   String
  branchId     String
  serialNumber String
  brand        String?
  model        String?
  color        String?
  voltage      String?                           // NUEVO (Paso 4)
  notes        String?
  createdAt    DateTime @default(now())

  customer      Customer       @relation(fields: [customerId], references: [id])
  branch        Branch         @relation(fields: [branchId], references: [id])
  serviceOrders ServiceOrder[]

  @@unique([serialNumber, branchId])
}
```

**Nota:** `@@map("ModeloConfiguracion")` preserva el nombre de la tabla PostgreSQL existente, evitando una migracion destructiva de renombrar tabla. Solo cambia el nombre del modelo en el codigo TypeScript/Prisma.

---

## 5. Plan de Migracion Revisado

### Paso 1: `add-modelo-image-url`

**Objetivo:** Agregar campo de imagen al modelo base.

**Cambios en schema:**
```prisma
model Modelo {
  // ... campos existentes ...
  imageUrl String?  // NUEVO
}
```

**Archivos afectados:** Solo `prisma/schema.prisma`
**Migracion:** `npx prisma migrate dev --name add-modelo-image-url`
**Riesgo:** Nulo. Campo nullable, sin impacto en codigo existente.

**Checklist de validacion:**
- [ ] `npx prisma migrate dev` ejecuta sin errores
- [ ] `npx prisma db seed` ejecuta sin errores
- [ ] `npm run build` compila sin errores

---

### Paso 2: `add-precio-distribuidor`

**Objetivo:** Agregar precio distribuidor como campo opcional con flag de confirmacion.

**Cambios en schema:**
```prisma
model ModeloConfiguracion {
  // ... campos existentes ...
  precioDistribuidor          Decimal? @db.Decimal(10, 2)  // NUEVO
  precioDistribuidorConfirmado Boolean  @default(false)     // NUEVO
}
```

**Migracion SQL esperada:**
```sql
ALTER TABLE "ModeloConfiguracion" ADD COLUMN "precioDistribuidor" DECIMAL(10,2);
ALTER TABLE "ModeloConfiguracion" ADD COLUMN "precioDistribuidorConfirmado" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ModeloConfiguracion" SET "precioDistribuidor" = "costo";
```

**Script post-migracion:** Ejecutar `UPDATE` para inicializar `precioDistribuidor = costo` en registros existentes.

**Cambios en UI:**
- En las vistas que muestran precio de variante (inventario, POS, layaways), agregar badge condicional:
  ```tsx
  {!variant.precioDistribuidorConfirmado && (
    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
      Precio distribuidor pendiente
    </span>
  )}
  ```

**Archivos afectados:**
| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar 2 campos |
| `src/app/(pos)/inventory/page.tsx` | Mostrar badge si no confirmado |
| `src/app/(pos)/point-of-sale/page.tsx` | Mostrar badge si no confirmado |

**Riesgo:** Bajo. Campos nuevos nullable/default, no rompen codigo existente.

**Checklist de validacion:**
- [ ] Migracion ejecuta sin errores
- [ ] Seed ejecuta sin errores
- [ ] Badge "Precio distribuidor pendiente" visible en inventario
- [ ] `npm run build` compila sin errores

---

### Paso 3+5 (fusionado): `rename-precio-and-product-variant`

**Objetivo:** Rename atomico de campo `precio` a `precioPublico` y modelo `ModeloConfiguracion` a `ProductVariant` en todo el codebase.

**Cambios en schema:**
```prisma
model ProductVariant {
  // ... (antes ModeloConfiguracion)
  precioPublico Decimal @db.Decimal(10, 2)  // antes "precio"
  // ...
  @@map("ModeloConfiguracion")  // preserva tabla en DB
}
```

**Migracion SQL esperada:**
```sql
ALTER TABLE "ModeloConfiguracion" RENAME COLUMN "precio" TO "precioPublico";
-- No se renombra la tabla; @@map lo maneja en Prisma
```

**Archivos afectados (codigo):**

| Archivo | Tipo de cambio |
|---------|---------------|
| `prisma/schema.prisma` | Rename model + campo |
| `prisma/seed.ts` | `prisma.modeloConfiguracion` -> `prisma.productVariant`, `precio` -> `precioPublico` |
| `prisma/data/modelo_configuracion.csv` | Header: `precio` -> `precioPublico` |
| `src/actions/sale.ts` | Refs a `modeloConfiguracion` -> `productVariant` |
| `src/actions/inventory.ts` | Refs a `modeloConfiguracion` -> `productVariant` |
| `src/actions/workshop.ts` | Refs a `modeloConfiguracion` -> `productVariant` |
| `src/app/(pos)/inventory/page.tsx` | Refs a `modeloConfiguracion` y `.precio` |
| `src/app/(pos)/inventory/receipts/page.tsx` | Refs a `modeloConfiguracion` |
| `src/app/(pos)/inventory/receipts/receipts-terminal.tsx` | Refs a `modeloConfiguracion` |
| `src/app/(pos)/point-of-sale/page.tsx` | Refs a `modeloConfiguracion` y `.precio` |
| `src/app/(pos)/point-of-sale/pos-terminal.tsx` | Refs a `modeloConfiguracion` |
| `src/app/(pos)/point-of-sale/guided-catalog.tsx` | Refs a `.precio` |
| `src/app/(pos)/layaways/page.tsx` | Refs a `modeloConfiguracion` y `.precio` |
| `src/app/(pos)/workshop/[id]/page.tsx` | Refs a `modeloConfiguracion` y `.precio` |
| `src/app/(pos)/workshop/[id]/service-order-details.tsx` | Refs a `modeloConfiguracion` |
| `src/app/api/modelos/[id]/colores/[colorId]/voltajes/route.ts` | Refs a `modeloConfiguracion` y `.precio` |
| `src/app/api/modelos/route.ts` | Refs a `.precio` |
| `src/lib/auth.ts` | Verificar si referencia el modelo (improbable, pero confirmar) |
| `seed-inventory.js` | Refs a `modeloConfiguracion` si aplica |

**Sub-paso obligatorio: Actualizacion del Seed**

El seed (`prisma/seed.ts`) y los CSVs en `prisma/data/` usan `modeloConfiguracion` y `precio`. Si no se actualizan junto con este paso, un `prisma db seed` fresco falla. Cambios requeridos:

1. **`prisma/seed.ts`:**
   - `prisma.modeloConfiguracion.upsert(...)` -> `prisma.productVariant.upsert(...)`
   - `precio: parseFloat(row.precio)` -> `precioPublico: parseFloat(row.precioPublico)`
   - Refs en `Stock.modeloConfiguracionId` -> evaluar si el campo en schema usa `@map` (si, usa `@map("productId")`, asi que el campo TS no cambia en Stock)

2. **`prisma/data/modelo_configuracion.csv`:**
   - Renombrar header `precio` a `precioPublico`
   - Opcionalmente renombrar el archivo a `product_variant.csv` (si se renombra, actualizar la ruta en `seed.ts`)

3. **`seed-inventory.js`:**
   - Actualizar refs a `modeloConfiguracion` si existen

**Estrategia de rename:**
- Usar buscar-y-reemplazar mecanico en todos los archivos
- En Prisma Client: `prisma.modeloConfiguracion` -> `prisma.productVariant`
- En tipos TS: `ModeloConfiguracion` -> `ProductVariant`
- En relaciones: `modeloConfiguracion` (nombre de relacion) -> `productVariant`
- El campo `modeloConfiguracionId` en Stock, SaleItem, etc. mantiene su `@map("productId")`, pero el nombre TS cambia a `productVariantId`

**Riesgo:** Medio-alto. Toca muchos archivos. Mitigacion: un solo commit atomico, buscar-y-reemplazar exhaustivo, build completo antes de commit.

**Checklist de validacion:**
- [ ] `npx prisma migrate dev` ejecuta sin errores
- [ ] `npx prisma db seed` ejecuta sin errores (sub-paso seed actualizado)
- [ ] `npm run lint` pasa sin errores
- [ ] `npm run build` compila sin errores de TypeScript
- [ ] Grep del codebase por `modeloConfiguracion` (case-insensitive) retorna 0 resultados fuera de migraciones
- [ ] Grep por `.precio` (como acceso a campo, no `precioPublico` ni `precioDistribuidor`) retorna 0 resultados fuera de migraciones
- [ ] Verificar que POS, inventario, taller y layaways cargan sin errores en navegador

---

### Paso 4: `add-customer-bike-voltage`

**Objetivo:** Agregar voltaje opcional a bicicleta de cliente.

**Cambios en schema:**
```prisma
model CustomerBike {
  // ... campos existentes ...
  voltage String?  // NUEVO
}
```

**Archivos afectados:**
| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Agregar campo |
| `src/app/(pos)/workshop/[id]/page.tsx` | Mostrar voltaje si existe |
| `src/app/(pos)/workshop/[id]/service-order-details.tsx` | Mostrar voltaje si existe |

**Riesgo:** Nulo. Campo nullable, sin impacto en codigo existente.

**Checklist de validacion:**
- [ ] Migracion ejecuta sin errores
- [ ] `npm run build` compila sin errores

---

### Paso 5 (antes 6): `make-precio-distribuidor-required`

**Objetivo:** Una vez confirmados todos los precios distribuidor, hacer el campo NOT NULL.

**Pre-requisito:** Todos los registros tienen `precioDistribuidorConfirmado = true`.

**Cambios en schema:**
```prisma
model ProductVariant {
  // ...
  precioDistribuidor Decimal @db.Decimal(10, 2)  // ya no es nullable
  // precioDistribuidorConfirmado se puede conservar o eliminar
}
```

**Migracion SQL esperada:**
```sql
-- Verificar que no hay nulls
SELECT COUNT(*) FROM "ModeloConfiguracion" WHERE "precioDistribuidor" IS NULL;
-- Si es 0:
ALTER TABLE "ModeloConfiguracion" ALTER COLUMN "precioDistribuidor" SET NOT NULL;
```

**Riesgo:** Bajo, pero requiere que el pre-requisito se cumpla. Si hay nulls, la migracion falla.

**Checklist de validacion:**
- [ ] Query de verificacion retorna 0 nulls
- [ ] Migracion ejecuta sin errores
- [ ] `npm run build` compila sin errores

---

## 6. Analisis de Impacto

### Archivos por paso

| Paso | Archivos modificados | Riesgo |
|------|---------------------|--------|
| 1: `add-modelo-image-url` | 1 (schema) | Nulo |
| 2: `add-precio-distribuidor` | 3 (schema + 2 UI) | Bajo |
| 3+5: `rename-precio-and-product-variant` | 18+ (schema + seed + CSVs + actions + pages + API routes) | Medio-alto |
| 4: `add-customer-bike-voltage` | 3 (schema + 2 UI) | Nulo |
| 5: `make-precio-distribuidor-required` | 1 (schema) | Bajo |

### Dashboard (`src/app/(pos)/dashboard/page.tsx`)

**Resultado de verificacion: NO se rompe.**

El dashboard fue analizado linea por linea. Sus queries son:
- `prisma.sale.aggregate(...)` — usa `total` de `Sale`, no de `ModeloConfiguracion`
- `prisma.serviceOrder.count(...)` — sin referencia a catalogo
- `prisma.sale.count(...)` — sin referencia a catalogo
- `prisma.sale.findMany(...)` — incluye `customer` y `user`, no variantes de producto
- `prisma.serviceOrder.findMany(...)` — incluye `customer`, no variantes de producto

El dashboard no hace join a `ModeloConfiguracion`, no lee `.precio`, y no muestra nombres de producto. Opera exclusivamente sobre `Sale.total`, `Sale.folio`, `Sale.status`, `ServiceOrder.folio`, `ServiceOrder.bikeInfo`, y `ServiceOrder.diagnosis`. Ninguno de estos campos cambia en esta migracion.

**Conclusion:** Dashboard NO requiere cambios. No se agrega al analisis de impacto.

### Dependencias externas

- **`seed-inventory.js`:** Archivo JS suelto en la raiz. Usa `modeloConfiguracion`. Debe actualizarse en el paso fusionado 3+5.
- **`src/app/api/modelos/`:** Directorio de API routes del catalogo. Contiene refs a `.precio`. Debe actualizarse en paso 3+5.
- **`src/lib/auth.ts`:** Modificado segun git status, pero no referencia el modelo de catalogo. Sin impacto.

---

## 7. Server Actions — Decision Explicita

**Decision: NO refactorizar en Fase 1B. Documentar como deuda tecnica.**

Los siguientes archivos contienen Server Actions con logica de negocio, violando la regla de CLAUDE.md:

| Archivo | Funcion | Logica de negocio |
|---------|---------|-------------------|
| `src/actions/sale.ts` | `processSaleAction` | Transaccion de venta: crea Sale, SaleItems, actualiza Stock, registra CashTransaction |
| `src/actions/inventory.ts` | Funciones de inventario | Movimientos de inventario, transferencias |
| `src/actions/workshop.ts` | Funciones de taller | CRUD de ServiceOrder, actualizacion de status |

**Justificacion para no refactorizar ahora:**
1. Esta fase es de rename mecanico. Refactorizar Server Actions a API Routes es un cambio arquitectonico.
2. `sale.ts` maneja transacciones financieras dentro de `prisma.$transaction()`. Un error en la migracion a API Route puede causar inconsistencias de datos.
3. El testing manual requerido para validar la refactorizacion es independiente del testing de esta fase.

**Compromiso:** En esta fase, los 3 archivos de actions se actualizan mecanicamente (rename de `modeloConfiguracion` -> `productVariant` y `.precio` -> `.precioPublico`), pero la estructura Server Action se mantiene intacta.

**Fase 2 (posterior):** Migrar `sale.ts`, `inventory.ts` y `workshop.ts` a API Routes en `src/app/api/`, con testing independiente por cada archivo.

---

## 8. Restricciones

1. **Cada paso es un commit atomico.** Si un paso falla, se revierte sin afectar los anteriores.
2. **No se puede saltar el orden.** El paso 5 depende de que el paso 2 ya exista y el paso 3+5 ya haya renombrado el modelo.
3. **`@@map("ModeloConfiguracion")`** es obligatorio para evitar renombrar la tabla PostgreSQL. Renombrar tablas con datos es destructivo y requiere downtime.
4. **El seed debe funcionar en cada paso.** Un `prisma db seed` fresco debe ejecutar sin errores despues de cada migracion.
5. **Zero downtime:** Ninguna migracion debe requerir downtime. Todas son `ADD COLUMN` nullable o `RENAME COLUMN`, operaciones no-bloqueantes en PostgreSQL.
6. **No usar `any`** en ningun cambio de TypeScript. Si el rename genera tipos faltantes, crear interfaces explicitas.
7. **Strings visibles en espanol.** Cualquier texto nuevo en la UI (como "Precio distribuidor pendiente") debe estar en espanol.

---

## 9. Lo que NO Cambia

- Logica de autenticacion y sesion (NextAuth, JWT)
- Estructura de rutas y navegacion
- Componentes shadcn en `src/components/ui/`
- Dashboard (`src/app/(pos)/dashboard/page.tsx`)
- `CashSessionManager` overlay
- Esquema de `Sale`, `SaleItem`, `CashTransaction`, `ServiceOrder` (solo se renombran las FKs de relacion)
- Arquitectura Server Action (se mantiene como deuda tecnica)
