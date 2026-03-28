# Catalog Redesign Phase 1B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 atomic schema migrations to evolve the product catalog model — adding imageUrl to Modelo, adding precioDistribuidor with confirmation flag, renaming precio→precioPublico and ModeloConfiguracion→ProductVariant across the codebase, and adding VoltageChangeLog to CustomerBike.

**Architecture:** Incremental Prisma migrations using `@map` and `@@map` directives to preserve existing DB column/table names while renaming at the TypeScript/Prisma Client layer. Each paso is one `migrate dev` + one commit. `lint` and `build` must pass before every commit. No `prisma db push` ever.

**Tech Stack:** Prisma 6 + PostgreSQL, TypeScript 5, Next.js 16 App Router, `npx prisma migrate dev`

---

## Correcciones del usuario (precedencia sobre la spec)

1. **Pasos 3 y 5 fusionados** en un único paso atómico: una sola migración + un solo commit.
2. **`seed-inventory.js` se elimina** en el paso 3+5 (no se actualiza — es deuda técnica).
3. **Paso 5 (`make-precio-distribuidor-required`) NO se ejecuta** en esta sesión. Se documenta como pendiente operativo.
4. **Campo voltaje en español** (`voltaje String?`), no `voltage`.

---

## Mapa de archivos

| Archivo | Pasos que lo tocan |
|---------|-------------------|
| `prisma/schema.prisma` | 1, 2, 3+5, 4 |
| `prisma/seed.ts` | 3+5 |
| `prisma/data/modelo_configuracion.csv` | 3+5 (header) |
| `seed-inventory.js` | 3+5 (DELETE) |
| `src/actions/sale.ts` | 3+5, 4 |
| `src/actions/inventory.ts` | 3+5 |
| `src/actions/workshop.ts` | 3+5 |
| `src/app/(pos)/point-of-sale/page.tsx` | 2, 3+5 |
| `src/app/(pos)/point-of-sale/pos-terminal.tsx` | 3+5 |
| `src/app/(pos)/point-of-sale/guided-catalog.tsx` | 3+5 |
| `src/app/(pos)/inventory/page.tsx` | 2, 3+5 |
| `src/app/(pos)/inventory/receipts/page.tsx` | 3+5 |
| `src/app/(pos)/inventory/receipts/receipts-terminal.tsx` | 3+5 |
| `src/app/(pos)/layaways/page.tsx` | 3+5 |
| `src/app/(pos)/workshop/[id]/page.tsx` | 3+5, 4 |
| `src/app/(pos)/workshop/[id]/service-order-details.tsx` | 3+5, 4 |
| `src/app/api/modelos/route.ts` | 1, 3+5 |
| `src/app/api/modelos/[id]/colores/[colorId]/voltajes/route.ts` | 3+5 |

---

## Task 1: Paso 1 — `add-modelo-image-url`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/modelos/route.ts`

- [ ] **Step 1.1: Leer el bloque Modelo en schema.prisma**

Verificar el estado actual antes de editar (líneas 41–52):
```prisma
model Modelo {
  id           String   @id @default(uuid())
  nombre       String   @unique
  descripcion  String?
  requiere_vin Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  coloresDisponibles ModeloColor[]
  configuraciones    ModeloConfiguracion[]
  commissionRules    CommissionRule[]
}
```

- [ ] **Step 1.2: Agregar `imageUrl` a Modelo en `prisma/schema.prisma`**

Cambiar el bloque Modelo a:
```prisma
model Modelo {
  id           String   @id @default(uuid())
  nombre       String   @unique
  descripcion  String?
  requiere_vin Boolean  @default(true)
  imageUrl     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  coloresDisponibles ModeloColor[]
  configuraciones    ModeloConfiguracion[]
  commissionRules    CommissionRule[]
}
```

- [ ] **Step 1.3: Ejecutar migración**

```bash
npx prisma migrate dev --name add-modelo-image-url
```

Verificar que la migración generada contiene:
```sql
ALTER TABLE "Modelo" ADD COLUMN "imageUrl" TEXT;
```
Y que NO contiene DROP TABLE ni DROP COLUMN.

- [ ] **Step 1.4: Actualizar `src/app/api/modelos/route.ts`**

Cambiar (línea 27):
```typescript
imagenPrincipal: m.configuraciones[0]?.imageUrl || null,
```
Por:
```typescript
imagenPrincipal: m.imageUrl || null,
```

- [ ] **Step 1.5: Verificar build y lint**

```bash
npx tsc --noEmit
npm run build
```

Deben pasar sin errores.

- [ ] **Step 1.6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/app/api/modelos/route.ts
git commit -m "feat: agregar imageUrl al modelo base de producto"
```

---

## Task 2: Paso 2 — `add-precio-distribuidor`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/(pos)/inventory/page.tsx`
- Modify: `src/app/(pos)/point-of-sale/page.tsx`

- [ ] **Step 2.1: Leer bloque ModeloConfiguracion en schema.prisma**

Verificar estado actual (líneas 79–99):
```prisma
model ModeloConfiguracion {
  id         String  @id @default(uuid())
  modelo_id  String
  color_id   String
  voltaje_id String
  sku        String  @unique
  precio     Decimal @db.Decimal(10, 2)
  costo      Decimal @db.Decimal(10, 2)
  imageUrl   String?
  ...
}
```

- [ ] **Step 2.2: Agregar campos en `prisma/schema.prisma`**

Cambiar el bloque ModeloConfiguracion agregando los dos campos nuevos después de `costo`:
```prisma
model ModeloConfiguracion {
  id         String  @id @default(uuid())
  modelo_id  String
  color_id   String
  voltaje_id String
  sku        String  @unique
  precio     Decimal @db.Decimal(10, 2)
  costo      Decimal @db.Decimal(10, 2)
  precioDistribuidor           Decimal? @db.Decimal(10, 2)
  precioDistribuidorConfirmado Boolean  @default(false)
  imageUrl   String?
  ...
}
```

- [ ] **Step 2.3: Ejecutar migración**

```bash
npx prisma migrate dev --name add-precio-distribuidor
```

Verificar que la migración generada contiene:
```sql
ALTER TABLE "ModeloConfiguracion" ADD COLUMN "precioDistribuidor" DECIMAL(10,2);
ALTER TABLE "ModeloConfiguracion" ADD COLUMN "precioDistribuidorConfirmado" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2.4: Inicializar precioDistribuidor con costo (script post-migración)**

Ejecutar el siguiente script SQL directamente en la DB (via psql, Prisma Studio query, o un script ts-node):

```sql
UPDATE "ModeloConfiguracion" SET "precioDistribuidor" = "costo";
```

Para ejecutarlo via Prisma en un script temporal:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$executeRaw\`UPDATE \"ModeloConfiguracion\" SET \"precioDistribuidor\" = \"costo\"\`
  .then(n => { console.log('Actualizados:', n, 'registros'); return prisma.\$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
"
```

Verificar: `SELECT COUNT(*) FROM "ModeloConfiguracion" WHERE "precioDistribuidor" IS NULL;` debe retornar 0.

- [ ] **Step 2.5: Agregar serialización y badge en `src/app/(pos)/inventory/page.tsx`**

El campo `price: Number(p.precio)` ya existe. Agregar los nuevos campos en el map (después de `cost`):
```typescript
const products = rawProducts.map(p => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precio),
    cost: Number(p.costo),
    precioDistribuidor: p.precioDistribuidor ? Number(p.precioDistribuidor) : null,
    precioDistribuidorConfirmado: p.precioDistribuidorConfirmado,
    stock: p.stocks[0]?.quantity || 0
}));
```

Agregar badge en la columna "Precio Venta" (dentro del `TableCell`):
```tsx
<TableCell className="text-right font-medium text-emerald-600">
    ${p.price.toFixed(2)}
    {!p.precioDistribuidorConfirmado && (
        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Precio dist. pendiente
        </span>
    )}
</TableCell>
```

- [ ] **Step 2.6: Agregar serialización en `src/app/(pos)/point-of-sale/page.tsx`**

En el map de productos, agregar los nuevos campos después de `cost`:
```typescript
const products = rawProducts.map((p: any) => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precio),
    cost: Number(p.costo),
    precioDistribuidor: p.precioDistribuidor ? Number(p.precioDistribuidor) : null,
    precioDistribuidorConfirmado: p.precioDistribuidorConfirmado,
    color: p.color.nombre,
    voltage: p.voltaje.label,
    imageUrl: p.modelo.imageUrl || null,
    baseProductId: p.modelo.id,
    baseProduct: p.modelo,
}));
```

- [ ] **Step 2.7: Verificar build y lint**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 2.8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ \
  src/app/\(pos\)/inventory/page.tsx \
  src/app/\(pos\)/point-of-sale/page.tsx
git commit -m "feat: agregar precioDistribuidor con flag de confirmación a variante de producto"
```

---

## Task 3: Paso 3+5 — `rename-precio-and-product-variant` (fusionado)

Este es el paso más grande. Toca 18+ archivos. Estrategia:
1. Editar `prisma/schema.prisma` con todos los renames + directivas `@map`/`@@map`
2. Ejecutar `npx prisma migrate dev` y verificar que el SQL generado no sea destructivo
3. Actualizar todos los archivos TypeScript en orden
4. Actualizar seed y CSV
5. Eliminar `seed-inventory.js`
6. Verificar build completo
7. Un único commit atómico

### Reglas de rename

| Antes (TS/Prisma) | Después (TS/Prisma) | DB (sin cambio) |
|---|---|---|
| `ModeloConfiguracion` (model) | `ProductVariant` | tabla `ModeloConfiguracion` (via `@@map`) |
| `precio` (field) | `precioPublico` | columna `precio` (via `@map`) |
| `modeloConfiguracionId` (FK field) | `productVariantId` | columna `productId` (via `@map("productId")`) |
| `modeloConfiguracion` (relation) | `productVariant` | FK sin cambio |
| `prisma.modeloConfiguracion` | `prisma.productVariant` | — |
| `ModeloConfiguracion` (TS type from @prisma/client) | `ProductVariant` | — |
| unique key `modeloConfiguracionId_branchId` | `productVariantId_branchId` | constraint sin cambio |

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `prisma/data/modelo_configuracion.csv`
- Delete: `seed-inventory.js`
- Modify: `src/actions/sale.ts`
- Modify: `src/actions/inventory.ts`
- Modify: `src/actions/workshop.ts`
- Modify: `src/app/(pos)/point-of-sale/page.tsx`
- Modify: `src/app/(pos)/point-of-sale/pos-terminal.tsx`
- Modify: `src/app/(pos)/point-of-sale/guided-catalog.tsx`
- Modify: `src/app/(pos)/inventory/page.tsx`
- Modify: `src/app/(pos)/inventory/receipts/page.tsx`
- Modify: `src/app/(pos)/inventory/receipts/receipts-terminal.tsx`
- Modify: `src/app/(pos)/layaways/page.tsx`
- Modify: `src/app/(pos)/workshop/[id]/page.tsx`
- Modify: `src/app/(pos)/workshop/[id]/service-order-details.tsx`
- Modify: `src/app/api/modelos/route.ts`
- Modify: `src/app/api/modelos/[id]/colores/[colorId]/voltajes/route.ts`

- [ ] **Step 3.1: Editar `prisma/schema.prisma` — renombrar modelo y campos**

**Modelo** (sin cambio, pero actualizar relación):
```prisma
model Modelo {
  // ... campos existentes ...
  configuraciones    ProductVariant[]   // era: ModeloConfiguracion[]
  // ...
}
```

**Color** (actualizar relación):
```prisma
model Color {
  // ...
  configuraciones ProductVariant[]   // era: ModeloConfiguracion[]
}
```

**Voltaje** (actualizar relación):
```prisma
model Voltaje {
  // ...
  configuraciones ProductVariant[]   // era: ModeloConfiguracion[]
}
```

**ProductVariant** (era ModeloConfiguracion):
```prisma
model ProductVariant {
  id         String  @id @default(uuid())
  modelo_id  String
  color_id   String
  voltaje_id String
  sku        String  @unique
  precioPublico                Decimal  @map("precio") @db.Decimal(10, 2)
  costo                        Decimal  @db.Decimal(10, 2)
  precioDistribuidor           Decimal? @db.Decimal(10, 2)
  precioDistribuidorConfirmado Boolean  @default(false)
  imageUrl   String?

  modelo  Modelo  @relation(fields: [modelo_id], references: [id])
  color   Color   @relation(fields: [color_id], references: [id])
  voltaje Voltaje @relation(fields: [voltaje_id], references: [id])

  stocks             Stock[]
  saleItems          SaleItem[]
  serviceOrderItems  ServiceOrderItem[]
  inventoryMovements InventoryMovement[]

  @@unique([modelo_id, color_id, voltaje_id])
  @@map("ModeloConfiguracion")
}
```

**Stock** (renombrar FK field y relation):
```prisma
model Stock {
  id               String         @id @default(uuid())
  productVariantId String         @map("productId")
  branchId         String
  quantity         Int            @default(0)
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id])
  branch           Branch         @relation(fields: [branchId], references: [id])

  @@unique([productVariantId, branchId])
}
```

**InventoryMovement** (renombrar FK field y relation):
```prisma
model InventoryMovement {
  id               String         @id @default(uuid())
  productVariantId String         @map("productId")
  branchId         String
  quantity         Int
  type             MovementType
  referenceId      String?
  userId           String
  createdAt        DateTime       @default(now())
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id])
}
```

**SaleItem** (renombrar FK field y relation):
```prisma
model SaleItem {
  id               String         @id @default(uuid())
  saleId           String
  productVariantId String         @map("productId")
  quantity         Int
  price            Decimal        @db.Decimal(10, 2)
  discount         Decimal        @default(0) @db.Decimal(10, 2)
  sale             Sale           @relation(fields: [saleId], references: [id])
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id])
}
```

**ServiceOrderItem** (renombrar FK field y relation):
```prisma
model ServiceOrderItem {
  id               String          @id @default(uuid())
  serviceOrderId   String
  productVariantId String?         @map("productId")
  serviceCatalogId String?
  description      String
  quantity         Int             @default(1)
  price            Decimal         @db.Decimal(10, 2)

  serviceOrder   ServiceOrder    @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  productVariant ProductVariant? @relation(fields: [productVariantId], references: [id])
  serviceCatalog ServiceCatalog? @relation(fields: [serviceCatalogId], references: [id])
}
```

- [ ] **Step 3.2: Ejecutar migración y revisar SQL generado**

```bash
npx prisma migrate dev --name rename-precio-and-product-variant
```

El SQL generado debe contener SOLO:
```sql
ALTER TABLE "ModeloConfiguracion" RENAME COLUMN "precio" TO "precioPublico";
```

**Verificar que NO contiene:**
- `DROP TABLE`
- `DROP COLUMN`
- `DROP CONSTRAINT` + `ADD CONSTRAINT` (rename de constraints de FK)
- `CREATE TABLE` / `ALTER TABLE ... ADD COLUMN` (ya se agregaron en pasos anteriores)

Si la migración intenta hacer algo destructivo, **NO confirmar**. Revisar los `@map` en el schema y corregir antes de continuar.

- [ ] **Step 3.3: Actualizar `src/actions/inventory.ts`**

Cambios:
1. `(session.user as any).id` y `.branchId` → usar `SessionUser` interface (agregar al archivo)
2. `tx.modeloConfiguracion.update(...)` → `tx.productVariant.update(...)`
3. `modeloConfiguracionId` en `ReceiptInput.items` → `productVariantId`
4. `catch (error: any)` → `catch (error: unknown)` + guard
5. `console.error` → eliminar

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface SessionUser {
    id: string;
    branchId: string;
}

interface ReceiptInput {
    items: {
        productVariantId: string;
        quantity: number;
        cost: number;
    }[];
    reference: string;
}

export async function receiveInventoryAction(input: ReceiptInput) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as unknown as SessionUser;

        if (!input.items || input.items.length === 0) {
            return { success: false, error: "No hay productos en esta recepción" };
        }

        await prisma.$transaction(async (tx) => {
            for (const item of input.items) {
                if (item.quantity <= 0) continue;

                await tx.stock.upsert({
                    where: {
                        productVariantId_branchId: {
                            productVariantId: item.productVariantId,
                            branchId: branchId
                        }
                    },
                    update: {
                        quantity: { increment: item.quantity }
                    },
                    create: {
                        productVariantId: item.productVariantId,
                        branchId: branchId,
                        quantity: item.quantity
                    }
                });

                await tx.productVariant.update({
                    where: { id: item.productVariantId },
                    data: { costo: item.cost }
                });

                await tx.inventoryMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        branchId: branchId,
                        userId: userId,
                        quantity: item.quantity,
                        type: "PURCHASE_RECEIPT",
                        referenceId: input.reference || "RECEIPT_BATCH",
                    }
                });
            }
        });

        revalidatePath("/inventory");
        revalidatePath("/inventory/receipts");

        return { success: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la mercancía";
        return { success: false, error: message };
    }
}
```

- [ ] **Step 3.4: Actualizar `src/actions/workshop.ts`**

Cambios en `addServiceOrderItem`:
1. `data.modeloConfiguracionId` → `data.productVariantId`
2. `modeloConfiguracionId_branchId: { modeloConfiguracionId: ... }` → `productVariantId_branchId: { productVariantId: ... }`
3. `tx.inventoryMovement.create({ data: { modeloConfiguracionId: ...` → `productVariantId: ...`
4. `tx.serviceOrderItem.create({ data: { modeloConfiguracionId: data.modeloConfiguracionId ?? null` → `productVariantId: data.productVariantId ?? null`

Cambiar la firma de la función:
```typescript
export async function addServiceOrderItem(data: {
    serviceOrderId: string;
    productVariantId?: string;
    description: string;
    quantity: number;
    price: number;
}) {
```

Cambiar el bloque de stock check (dentro de la transaction):
```typescript
if (data.productVariantId) {
    const stock = await tx.stock.findUnique({
        where: {
            productVariantId_branchId: {
                productVariantId: data.productVariantId,
                branchId
            }
        }
    });

    if (!stock || stock.quantity < data.quantity) {
        throw new Error("Stock insuficiente para la refacción seleccionada");
    }

    await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: data.quantity } }
    });

    await tx.inventoryMovement.create({
        data: {
            productVariantId: data.productVariantId,
            branchId,
            userId,
            type: "WORKSHOP_USAGE",
            quantity: -data.quantity,
            referenceId: data.serviceOrderId
        }
    });
}

await tx.serviceOrderItem.create({
    data: {
        serviceOrderId: data.serviceOrderId,
        productVariantId: data.productVariantId ?? null,
        description: data.description,
        quantity: data.quantity,
        price: data.price
    }
});
```

- [ ] **Step 3.5: Actualizar `src/actions/sale.ts`**

Cambios:
1. `interface SaleInput.items[].modeloConfiguracionId` → `productVariantId`
2. `tx.stock.findUnique({ where: { modeloConfiguracionId_branchId: { modeloConfiguracionId: item.modeloConfiguracionId, branchId } } })` → `productVariantId_branchId: { productVariantId: item.productVariantId, branchId }`
3. `tx.stock.update({ where: { id: stock.id } ...` → sin cambio (usa stock.id)
4. `tx.sale.create items.map(item => ({ modeloConfiguracionId: item.modeloConfiguracionId, ...` → `productVariantId: item.productVariantId, ...`
5. `tx.inventoryMovement.create({ data: { modeloConfiguracionId: item.modeloConfiguracionId, ...` → `productVariantId: item.productVariantId, ...`

Cambiar la interfaz:
```typescript
interface SaleInput {
    items: {
        productVariantId: string;
        quantity: number;
        price: number;
        name: string;
        isSerialized?: boolean;
        serialNumber?: string;
    }[];
    total: number;
    paymentMethod: "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE";
    isLayaway?: boolean;
    customerId?: string;
    downPayment?: number;
}
```

Cambiar stock check (líneas ~80-102):
```typescript
const stock = await tx.stock.findUnique({
    where: {
        productVariantId_branchId: {
            productVariantId: item.productVariantId,
            branchId: branchId
        }
    }
});

if (!stock || stock.quantity < item.quantity) {
    throw new Error(`Stock insuficiente para el producto: ${item.name}`);
}

await tx.stock.update({
    where: { id: stock.id },
    data: { quantity: { decrement: item.quantity } }
});
```

Cambiar `tx.sale.create items.map`:
```typescript
items: {
    create: input.items.map(item => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: item.price
    }))
}
```

Cambiar `inventoryMovement.create`:
```typescript
await tx.inventoryMovement.create({
    data: {
        productVariantId: item.productVariantId,
        branchId: branchId,
        userId: userId,
        type: "SALE",
        quantity: -item.quantity,
        referenceId: sale.id
    }
});
```

- [ ] **Step 3.6: Actualizar `src/app/(pos)/point-of-sale/page.tsx`**

Cambiar `prisma.modeloConfiguracion` → `prisma.productVariant` y `p.precio` → `p.precioPublico`:
```typescript
const rawProducts = await prisma.productVariant.findMany({
    include: {
        modelo: true,
        color: true,
        voltaje: true,
        stocks: {
            include: {
                branch: true,
            }
        }
    },
    orderBy: { sku: 'asc' }
});

const products = rawProducts.map((p: any) => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precioPublico),
    cost: Number(p.costo),
    precioDistribuidor: p.precioDistribuidor ? Number(p.precioDistribuidor) : null,
    precioDistribuidorConfirmado: p.precioDistribuidorConfirmado,
    color: p.color.nombre,
    voltage: p.voltaje.label,
    imageUrl: p.modelo.imageUrl || null,
    baseProductId: p.modelo.id,
    baseProduct: p.modelo,
}));
```

- [ ] **Step 3.7: Actualizar `src/app/(pos)/point-of-sale/pos-terminal.tsx`**

Cambiar import y tipo (líneas 4 y 38):
```typescript
import { ProductVariant, Stock, Branch } from "@prisma/client";
```

```typescript
type OmittedProduct = Omit<ProductVariant, 'precioPublico' | 'precioDistribuidor' | 'costo'>;
```

Cambiar el map de items en el submit (línea ~226):
```typescript
modeloConfiguracionId: item.product.id,
```
→
```typescript
productVariantId: item.product.id,
```

- [ ] **Step 3.8: Actualizar `src/app/(pos)/point-of-sale/guided-catalog.tsx`**

Cambiar el tipo `Voltaje` (línea ~31):
```typescript
type Voltaje = {
    id: string;
    valor: number;
    label: string;
    precioPublico: number;
    sku: string;
    configuracionId: string;
    stockTotal: number;
};
```

Cambiar la asignación de precio al construir el CartProduct (línea ~151):
```typescript
price: voltaje.precioPublico,
```

- [ ] **Step 3.9: Actualizar `src/app/(pos)/inventory/page.tsx`**

Cambiar `prisma.modeloConfiguracion` → `prisma.productVariant` y `p.precio` → `p.precioPublico`:
```typescript
const rawProducts = await prisma.productVariant.findMany({
    include: {
        stocks: {
            where: { branchId: branchId }
        },
        modelo: true,
        color: true,
        voltaje: true
    },
    orderBy: { sku: 'asc' }
});

const products = rawProducts.map(p => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precioPublico),
    cost: Number(p.costo),
    precioDistribuidor: p.precioDistribuidor ? Number(p.precioDistribuidor) : null,
    precioDistribuidorConfirmado: p.precioDistribuidorConfirmado,
    stock: p.stocks[0]?.quantity || 0
}));
```

- [ ] **Step 3.10: Actualizar `src/app/(pos)/inventory/receipts/page.tsx`**

```typescript
const rawProducts = await prisma.productVariant.findMany({
    include: {
        stocks: {
            include: { branch: true }
        },
        modelo: true,
        color: true,
        voltaje: true
    },
    orderBy: { sku: 'asc' }
});

const products = rawProducts.map(p => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precioPublico),
    cost: Number(p.costo)
}));
```

- [ ] **Step 3.11: Actualizar `src/app/(pos)/inventory/receipts/receipts-terminal.tsx`**

Cambiar la interface interna implícita y el map de items (líneas ~75-78):
```typescript
const formattedItems = cart.map(i => ({
    productVariantId: i.product.id,
    quantity: i.quantity,
    cost: i.cost
}));
```

- [ ] **Step 3.12: Leer `src/app/(pos)/layaways/layaway-list.tsx` antes de editar**

Buscar referencias a `modeloConfiguracion` o `.precio` en el componente. Si las tiene, actualizar al mismo tiempo que `layaways/page.tsx` (mismo commit). El grep de Step 3.20 las capturará de todas formas.

- [ ] **Step 3.12b: Actualizar `src/app/(pos)/layaways/page.tsx`**

Cambiar los includes y serialización:
```typescript
items: {
    include: {
        productVariant: {
            include: {
                modelo: true,
                color: true,
                voltaje: true
            }
        }
    }
}
```

En la serialización de items:
```typescript
items: l.items.map((i: any) => ({
    ...i,
    price: Number(i.price),
    discount: Number(i.discount),
    productVariant: {
        ...i.productVariant,
        precioPublico: Number(i.productVariant.precioPublico),
        costo: Number(i.productVariant.costo)
    }
}))
```

- [ ] **Step 3.13: Actualizar `src/app/(pos)/workshop/[id]/page.tsx`**

Cambiar todos los `modeloConfiguracion` → `productVariant` y `.precio` → `.precioPublico`:

En la query de order:
```typescript
items: {
    include: {
        productVariant: {
            include: {
                modelo: true,
                color: true,
                voltaje: true
            }
        }
    }
}
```

En `prisma.productVariant.findMany(...)` (era `modeloConfiguracion.findMany`).

En serialización de order:
```typescript
items: order.items.map((i: any) => ({
    ...i,
    price: Number(i.price),
    productVariant: i.productVariant ? {
        ...i.productVariant,
        precioPublico: Number(i.productVariant.precioPublico),
        costo: Number(i.productVariant.costo)
    } : null
}))
```

En serialización de products:
```typescript
const serializedProducts = products.map((p: any) => ({
    ...p,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precioPublico),
    cost: Number(p.costo)
}));
```

- [ ] **Step 3.14: Actualizar `src/app/(pos)/workshop/[id]/service-order-details.tsx`**

Cambiar tipos:
```typescript
type SerializedOrderItem = {
    id: string;
    serviceOrderId: string;
    productVariantId: string | null;
    description: string;
    quantity: number;
    price: number;
    productVariant: SerializedProduct | null;
};
```

Cambiar la llamada a `addServiceOrderItem` (línea ~108-114):
```typescript
const result = await addServiceOrderItem({
    serviceOrderId: order.id,
    productVariantId: prod.id,
    description: prod.name,
    quantity: parseInt(productQty) || 1,
    price: prod.price
});
```

Cambiar la referencia en el badge (línea ~381):
```tsx
{item.productVariant && (
    <Badge variant="outline" className="ml-2 text-[10px]">
        {item.productVariant.sku}
    </Badge>
)}
```

- [ ] **Step 3.15: Actualizar `src/app/api/modelos/route.ts`**

Cambiar la línea de `precioDesde`:
```typescript
const minPrice = m.configuraciones.length > 0
    ? Math.min(...m.configuraciones.map(c => Number(c.precioPublico)))
    : 0;
```

La relación `m.configuraciones` sigue siendo válida (Modelo tiene `configuraciones ProductVariant[]`).

- [ ] **Step 3.16: Actualizar `src/app/api/modelos/[id]/colores/[colorId]/voltajes/route.ts`**

Cambiar `conf.precio` → `conf.precioPublico` en el objeto retornado:
```typescript
const voltajesFormat = configuraciones.map(conf => {
    const stockTotal = conf.stocks.reduce((acc, stock) => acc + stock.quantity, 0);
    return {
        id: conf.voltaje.id,
        valor: conf.voltaje.valor,
        label: conf.voltaje.label,
        precioPublico: Number(conf.precioPublico),
        costo: Number(conf.costo),
        sku: conf.sku,
        configuracionId: conf.id,
        stockTotal
    };
});
```

- [ ] **Step 3.17: Actualizar `prisma/seed.ts`**

Cambios:
1. `prisma.modeloConfiguracion.upsert(...)` → `prisma.productVariant.upsert(...)`
2. `precio: parseFloat(row.precio)` → `precioPublico: parseFloat(row.precioPublico)` (×2: en update y create)
3. `prisma.stock.upsert` where clause: `modeloConfiguracionId_branchId` → `productVariantId_branchId`, `modeloConfiguracionId: configuracion.sku` → `productVariantId: configuracion.id` (nota: usar `.id`, no `.sku` — el campo es FK al id UUID)

```typescript
// Línea 145
const configuracion = await prisma.productVariant.upsert({
    where: { sku: row.sku },
    update: {
        precioPublico: parseFloat(row.precioPublico) || 0,
        costo: parseFloat(row.costo) || 0,
    },
    create: {
        sku: row.sku,
        precioPublico: parseFloat(row.precioPublico) || 0,
        costo: parseFloat(row.costo) || 0,
        modelo_id: modeloId,
        color_id: colorId,
        voltaje_id: voltajeId
    }
});

// Líneas 166-176 — usar configuracion.id, no configuracion.sku
await prisma.stock.upsert({
    where: { productVariantId_branchId: { productVariantId: configuracion.id, branchId: leoBranch.id } },
    update: { quantity: stockLeo },
    create: { productVariantId: configuracion.id, branchId: leoBranch.id, quantity: stockLeo }
});

await prisma.stock.upsert({
    where: { productVariantId_branchId: { productVariantId: configuracion.id, branchId: av135Branch.id } },
    update: { quantity: stockAv135 },
    create: { productVariantId: configuracion.id, branchId: av135Branch.id, quantity: stockAv135 }
});
```

Nota: la corrección de `configuracion.sku` → `configuracion.id` en las líneas de stock es un fix de bug pre-existente incluido en este paso por ser necesario para que el seed funcione correctamente post-rename.

- [ ] **Step 3.18: Actualizar `prisma/data/modelo_configuracion.csv`**

Renombrar el header `precio` a `precioPublico` en la primera línea del archivo.

Antes:
```
id,modelo_id,color_id,voltaje_id,sku,precio,costo,stock_leo,stock_av135
```

Después:
```
id,modelo_id,color_id,voltaje_id,sku,precioPublico,costo,stock_leo,stock_av135
```

- [ ] **Step 3.19: Eliminar `seed-inventory.js`**

```bash
rm seed-inventory.js
```

- [ ] **Step 3.20: Verificar grep exhaustivo**

```bash
# Debe retornar 0 resultados fuera de prisma/migrations/
grep -r "modeloConfiguracion" src/ --include="*.ts" --include="*.tsx"
grep -r "\.precio[^P]" src/ --include="*.ts" --include="*.tsx"
```

Si hay resultados, corregirlos antes de continuar.

- [ ] **Step 3.21: Regenerar Prisma client**

```bash
npx prisma generate
```

Verificar que no hay errores de schema.

- [ ] **Step 3.22: Verificar seed (fresh run)**

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}' npx ts-node prisma/seed.ts
```

Debe ejecutar sin errores fatales.

- [ ] **Step 3.23: Verificar build y lint**

```bash
npx tsc --noEmit
npm run build
```

Ambos deben pasar sin errores.

- [ ] **Step 3.24: Commit atómico**

```bash
git add prisma/ src/ -u
git rm seed-inventory.js
git commit -m "refactor: renombrar ModeloConfiguracion a ProductVariant y precio a precioPublico"
```

---

## Task 4: Paso 4 — `add-customer-bike-voltage`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/actions/sale.ts`
- Modify: `src/app/(pos)/workshop/[id]/page.tsx`
- Modify: `src/app/(pos)/workshop/[id]/service-order-details.tsx`

- [ ] **Step 4.1: Editar `prisma/schema.prisma` — agregar voltaje y VoltageChangeLog**

Cambiar el bloque `CustomerBike`:
```prisma
model CustomerBike {
  id           String   @id @default(uuid())
  customerId   String
  branchId     String
  serialNumber String
  brand        String?
  model        String?
  color        String?
  voltaje      String?
  notes        String?
  createdAt    DateTime @default(now())

  customer       Customer          @relation(fields: [customerId], references: [id])
  branch         Branch            @relation(fields: [branchId], references: [id])
  serviceOrders  ServiceOrder[]
  voltageChanges VoltageChangeLog[]

  @@unique([serialNumber, branchId])
}
```

Agregar el nuevo modelo al final del archivo (antes del último bloque `ServiceCatalog` o después):
```prisma
// === VOLTAGE CHANGE LOG ===
model VoltageChangeLog {
  id             String       @id @default(cuid())
  customerBikeId String
  fromVoltage    String
  toVoltage      String
  reason         String?
  userId         String
  createdAt      DateTime     @default(now())

  customerBike CustomerBike @relation(fields: [customerBikeId], references: [id])
}
```

- [ ] **Step 4.2: Ejecutar migración**

```bash
npx prisma migrate dev --name add-customer-bike-voltage
```

Verificar que la migración contiene:
```sql
ALTER TABLE "CustomerBike" ADD COLUMN "voltaje" TEXT;
CREATE TABLE "VoltageChangeLog" (
    "id" TEXT NOT NULL,
    "customerBikeId" TEXT NOT NULL,
    "fromVoltage" TEXT NOT NULL,
    "toVoltage" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoltageChangeLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "VoltageChangeLog" ADD CONSTRAINT "VoltageChangeLog_customerBikeId_fkey"
    FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4.3: Actualizar `src/actions/sale.ts` — poblar voltaje en CustomerBike**

Dentro de la transaction, cuando se crea `CustomerBike` (bloque `if (item.isSerialized && item.serialNumber)`), obtener el voltaje de la variante y agregarlo:

```typescript
if (item.isSerialized && item.serialNumber) {
    if (!input.customerId) {
        throw new Error(`El producto ${item.name} requiere un número de serie, y DEBES seleccionar o crear un cliente a quién asignárselo.`);
    }

    const existingBike = await tx.customerBike.findFirst({
        where: { serialNumber: item.serialNumber, branchId }
    });
    if (existingBike) {
        throw new Error(`Número de serie ya registrado en esta sucursal: ${item.serialNumber}`);
    }

    // Obtener etiqueta de voltaje de la variante
    const variant = await tx.productVariant.findUnique({
        where: { id: item.productVariantId },
        include: { voltaje: true }
    });

    await tx.customerBike.create({
        data: {
            customerId: input.customerId,
            branchId,
            serialNumber: item.serialNumber,
            brand: "EVOBIKE",
            model: item.name,
            voltaje: variant?.voltaje.label ?? null,
            notes: `Venta original Folio pendiente`
        }
    });
}
```

- [ ] **Step 4.4: Actualizar `src/app/(pos)/workshop/[id]/page.tsx` — incluir customerBike en query**

Agregar `customerBike` al include del order (dentro del `prisma.serviceOrder.findUnique`):
```typescript
const order = await prisma.serviceOrder.findUnique({
    where: { id: params.id },
    include: {
        customer: true,
        customerBike: {
            select: {
                serialNumber: true,
                voltaje: true,
                brand: true,
                model: true,
                color: true
            }
        },
        items: {
            include: {
                productVariant: {
                    include: {
                        modelo: true,
                        color: true,
                        voltaje: true
                    }
                }
            }
        },
        user: true,
    }
});
```

Incluir la bicicleta en el serializedOrder:
```typescript
const serializedOrder = {
    ...order,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    customerBike: order.customerBike ?? null,
    items: order.items.map((i: any) => ({
        ...i,
        price: Number(i.price),
        productVariant: i.productVariant ? {
            ...i.productVariant,
            precioPublico: Number(i.productVariant.precioPublico),
            costo: Number(i.productVariant.costo)
        } : null
    }))
};
```

- [ ] **Step 4.5: Actualizar `src/app/(pos)/workshop/[id]/service-order-details.tsx` — mostrar voltaje**

Agregar campo al tipo `FullSerializedOrder`:
```typescript
type FullSerializedOrder = {
    id: string;
    folio: string;
    status: ServiceOrderStatus;
    customerId: string;
    bikeInfo: string | null;
    diagnosis: string | null;
    subtotal: number;
    total: number;
    createdAt: Date;
    customer: { name: string, phone: string | null };
    user: { name: string };
    customerBike: {
        serialNumber: string;
        voltaje: string | null;
        brand: string | null;
        model: string | null;
        color: string | null;
    } | null;
    items: SerializedOrderItem[];
};
```

Mostrar voltaje en la sección "Bicicleta" del card de detalles (junto a `order.bikeInfo`):
```tsx
<div className="flex items-start gap-3 text-slate-600">
    <Bike className="w-4 h-4 mt-0.5 shrink-0" />
    <div>
        <p className="font-medium text-slate-900">Bicicleta</p>
        <p>{order.bikeInfo || "Sin especificar"}</p>
        {order.customerBike?.voltaje && (
            <p className="text-xs text-slate-500 mt-0.5">
                Voltaje: {order.customerBike.voltaje}
                {order.customerBike.serialNumber && ` · VIN: ${order.customerBike.serialNumber}`}
            </p>
        )}
    </div>
</div>
```

- [ ] **Step 4.6: Verificar build y lint**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4.7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ \
  src/actions/sale.ts \
  src/app/\(pos\)/workshop/
git commit -m "feat: agregar campo voltaje y tabla VoltageChangeLog a bicicleta de cliente"
```

---

## Pendiente operativo (NO ejecutar en esta sesión)

### Paso 5: `make-precio-distribuidor-required`

**Pre-requisito:** El cliente confirma todos los precios distribuidor manualmente en el sistema (`precioDistribuidorConfirmado = true` en TODOS los registros).

**Acción cuando esté listo:**
1. Verificar: `SELECT COUNT(*) FROM "ModeloConfiguracion" WHERE "precioDistribuidor" IS NULL OR "precioDistribuidorConfirmado" = false;` → debe retornar 0
2. Cambiar en schema: `precioDistribuidor Decimal? @db.Decimal(10, 2)` → `precioDistribuidor Decimal @db.Decimal(10, 2)`
3. `npx prisma migrate dev --name make-precio-distribuidor-required`
4. Remover badge "Precio dist. pendiente" del inventario
5. Build + commit

---

## Checklist final de validación (post Paso 4)

- [ ] `grep -r "modeloConfiguracion" src/ --include="*.ts" --include="*.tsx"` → 0 resultados
- [ ] `grep -r "\.precio[^P]" src/ --include="*.ts" --include="*.tsx"` → 0 resultados (excepto `precioPublico`, `precioDistribuidor`)
- [ ] `npx tsc --noEmit` → 0 errores
- [ ] `npm run build` → build exitoso
- [ ] `TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}' npx ts-node prisma/seed.ts` → seed sin errores fatales
- [ ] POS carga sin errores, precios visibles
- [ ] Inventario carga con badge en variantes sin precio confirmado
- [ ] Taller (workshop detail) carga sin errores
- [ ] Apartados (layaways) cargan sin errores
- [ ] `seed-inventory.js` no existe en el repositorio

---

## Confirmación de cierre

Al completar Task 4, confirmar: **"Fase 1B cerrada"** y entregar el siguiente bloque para Fase 1.5 (rediseño visual):

```
SESIÓN: Fase 1.5 — Rediseño visual
Spec de referencia: docs/superpowers/specs/2026-03-27-dashboard-redesign-design.md
Plan de referencia: docs/superpowers/plans/2026-03-27-dashboard-redesign.md
Rama actual: main
Archivos afectados: src/app/(pos)/layout.tsx, sidebar.tsx, dashboard/page.tsx
```
