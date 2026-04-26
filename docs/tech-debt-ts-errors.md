# Tech debt — TypeScript errors pre-existentes

> **Snapshot 2026-04-26** — `npx tsc --noEmit` reporta **195 errores únicos**, todos pre-existentes (verificados con `git stash` antes/después del commit `caff8bf` de Fase 0). Bloquean `next build` pero no afectan dev server. **Todos los errores están concentrados en el módulo de clientes** y son síntoma de drift entre el código y el schema actual de Prisma.

## Distribución por archivo

```
25  src/lib/customers/profile-tabs-data.ts
20  src/app/api/customers/[id]/bicis/[bikeId]/historial/pdf/route.tsx
19  src/lib/customers/profile-data.ts
15  src/lib/customers/profile-finanzas-data.ts
15  src/app/api/customers/[id]/ficha/pdf/route.tsx
11  src/app/api/customers/[id]/unmerge/route.ts
10  src/lib/customers/directory-query.ts
 9  src/app/api/customers/[id]/merge-into/route.ts
 8  src/app/api/customers/[id]/merge-preview/route.ts
 7  src/app/api/customers/[id]/route.ts
 5  src/app/api/customers/[id]/tags/route.ts
 5  src/app/api/customer-bikes/[id]/route.ts
 4  src/app/api/customers/route.ts
 3  src/app/api/workshop/orders/route.ts
+más
```

## Diagnóstico — schema drift en módulo customers

Los errores se agrupan en 3 categorías:

### 1. Relaciones que no existen en `CustomerBike` actual

`profile-tabs-data.ts` y similares hacen `include: { editLogs: ..., voltageChanges: ..., assemblyOrders: ..., serviceOrders: ..., batteryAssignments: ... }` pero el modelo `CustomerBike` actual solo tiene los siguientes campos (per el error TS):

```ts
{ id, branchId, customerId, createdAt, color, voltaje, model, notes,
  productVariantId, serialNumber, brand }
```

Faltan en el modelo (o están renombradas):
- `editLogs` — referencia a `customerEditLog` (probablemente renombrado/eliminado)
- `voltageChanges` — referencia a tabla de cambios de voltaje
- `assemblyOrders` — relación a órdenes de armado
- `serviceOrders` — relación a órdenes de servicio
- `batteryAssignments` — asignaciones de batería
- `productVariant` — relación a variante (existe `productVariantId` solo)
- `odometerKm` — campo de kilometraje

### 2. Campos que no existen en `Customer`

- `mergedIntoId` — `service.ts:30` referencia este campo en `CustomerWhereInput`, pero no está en el schema. Probablemente se renombró durante alguna migración del flujo de merge.

### 3. Models que no existen en el cliente Prisma

- `customerEditLog` — `service.ts:78` hace `tx.customerEditLog.*`, pero el modelo no existe. Renombrado o eliminado.

### 4. Parámetros con `any` implícito

Múltiples `Parameter 'm' implicitly has an 'any' type` en callbacks de `.map`, `.filter`, etc. Probablemente por TypeScript que dejó de inferir cuando los includes empezaron a fallar (cascada).

## Fix sugerido

Esto **no es un sweep de tipos** sino una sincronización schema↔código del módulo customers. Pasos:

1. **Revisar `prisma/schema.prisma`** para entender el shape actual de `Customer` y `CustomerBike` (qué relaciones existen hoy).
2. **Identificar qué cambió** comparando contra el shape esperado en código:
   - ¿Se renombró `customerEditLog` a otra cosa?
   - ¿Las relaciones `voltageChanges`, `assemblyOrders`, etc. nunca se agregaron al schema o se eliminaron?
   - ¿`mergedIntoId` cambió de nombre?
3. **Decidir caso por caso** si se actualiza el código (si el schema es la fuente de verdad) o se restablece el schema (si las relaciones deben existir y se perdieron por una migración).
4. **Verificar que el módulo customers funciona en dev** antes de declarar arreglado — si hace falta seed con datos de cliente, generar fixtures.

## Por qué no se arregla ahora

- Está fuera del scope de Fase 0 (Fase 0 = infra de tokens/tipos/barrels cross-módulo, no debugging de un módulo específico).
- Es un bloque coherente de ~6-10h de trabajo — merece su propia sesión con cabeza fresca.
- No bloquea Fase 0 ni el cluster Fase A (los módulos de cluster son Catálogo, Inventario, etc., no customers).
- Sí bloquea `next build` global → bloquea CI y deploy. Hay que arreglarlo antes de cualquier release real.

## Cuándo arreglar

- **Antes** de Fase 6 Hardening (deploy real necesita build pasando).
- **Después** de Fase 0 #4 + #5 (quick wins) y opcionalmente del helper canónico de I10.
- Si se rediseña el módulo Clientes en alguna iteración futura, aprovechar para resincronizar.

## Comando de verificación

```bash
npx tsc --noEmit 2>&1 | grep -E 'error TS[0-9]+' | wc -l
# Baseline 2026-04-26: 195 errores únicos.
```
