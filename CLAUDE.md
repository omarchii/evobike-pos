# CLAUDE.md

Guía de trabajo para Claude Code en este repositorio.
Lee este archivo completo antes de tocar cualquier código.

---

## Comandos

```bash
# Infraestructura (requiere Docker)
docker-compose up -d        # PostgreSQL en puerto 5434

# Desarrollo
npm run dev                 # Dev server en http://localhost:3000

# Base de datos
npx prisma migrate dev      # Aplicar migraciones pendientes
npx prisma db seed          # Seed inicial (usuarios, sucursales, catálogo)
npx prisma studio           # UI visual de la DB en http://localhost:5555

# Build y calidad
npm run build
npm run lint
```

No hay suite de tests configurada.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 + PostgreSQL
NextAuth 4 · shadcn/ui (new-york) · Tailwind CSS 4 · react-hook-form + Zod · sonner

---

## Arquitectura y flujo de datos

**Grupos de rutas:**

- `(auth)/` — rutas públicas (solo `/login`)
- `(pos)/` — rutas protegidas; el `layout.tsx` valida sesión server-side

**Patrón de datos:**

```
Server Components (page.tsx)
  └── Consultas Prisma directas con "use server"
        └── Datos como props a Client Components
              └── Mutaciones → API Routes en src/app/api/
```

**Consultas (lectura):**
Usar Server Components con lógica de servidor directa. Las páginas
(`page.tsx`) deben ser async y consultar Prisma directamente.
Marcar con `"use server"` o mantener como RSC (sin `"use client"`).

**Mutaciones (escritura):**
Toda lógica de negocio que modifique datos va en API Routes
(`src/app/api/`), nunca en Server Actions.
Los Client Components llaman a estas rutas con `fetch`.

**Autenticación:**
NextAuth con JWT. El token lleva `role`, `branchId`, `branchName`.
Todas las API routes validan sesión y respetan `branchId`.

**Multi-sucursal:**
Toda entidad mayor tiene `branch_id`.
Siempre filtrar por la sucursal del usuario, excepto ADMIN.

---

## Modelos de dominio clave (Prisma)

- **Modelo / Color / Voltaje / ModeloConfiguracion** — catálogo de productos con variantes. `ModeloConfiguracion` es único por `(modelo_id, color_id, voltaje_id)`.
- **Stock** — inventario por producto por sucursal. Se actualiza via `InventoryMovement` (tipos: `SALE`, `RETURN`, `TRANSFER_OUT/IN`, `ADJUSTMENT`, `PURCHASE_RECEIPT`, `WORKSHOP_USAGE`).
- **Sale / SaleItem** — ventas con folio y status (`COMPLETED | CANCELLED | LAYAWAY`). Requiere `CashRegisterSession` abierta.
- **CashRegisterSession / CashTransaction** — turno de caja por usuario. Métodos de pago: `CASH | CARD | TRANSFER | CREDIT_BALANCE`.
- **ServiceOrder / ServiceOrderItem** — órdenes de taller, Kanban: `PENDING → IN_PROGRESS → COMPLETED → DELIVERED`.
- **Customer / CustomerBike** — CRM con saldo de crédito y registro de bicicletas por VIN.
- **Layaway** — Sale con status `LAYAWAY`; pagos parciales en tabla separada.

---

## Reglas de código

### TypeScript

- **Prohibido usar `any`** en cualquier circunstancia.
  Usar `unknown` + type guard, tipos específicos, o `never` según el caso.
- Siempre tipar los retornos de funciones explícitamente.
- Los esquemas Zod son la fuente de verdad para tipos de formularios y API.

### Server Actions

- **No usar Server Actions para lógica de negocio ni mutaciones.**
- Su único uso permitido es como thin wrappers de revalidación si
  fuera estrictamente necesario.
- Toda mutación va en una API Route.

### API Routes (`src/app/api/`)

- Toda lógica de negocio que modifique datos va aquí.
- Siempre validar sesión con `getServerSession(authOptions)`.
- Usar `prisma.$transaction()` para operaciones multi-tabla.
- Serializar `Decimal` a `number` antes de responder (no es serializable por defecto).
- Retornar siempre `{ success: boolean, data?: T, error?: string }`.

### Consultas en páginas

- Los `page.tsx` deben ser Server Components async.
- Consultar Prisma directamente, nunca desde el cliente.
- Agregar `export const dynamic = "force-dynamic"` si los datos
  cambian frecuentemente.

### Componentes

- `src/components/ui/` — shadcn generados, **nunca editar manualmente**.
  Regenerar con `npx shadcn add [component]`.
- `src/components/pos/` — componentes de negocio reutilizables.
- Componentes específicos de una ruta van junto a su `page.tsx`.

### Formularios

- Siempre `react-hook-form` + schema Zod. Nunca `useState` para estado de formulario.

### Notificaciones

- Siempre `import { toast } from "sonner"`. Nunca `alert()` ni `console.log` en UI.

### Estilos

- Tailwind utility-first. `cn()` de `@/lib/utils` para clases condicionales.
- No crear archivos `.css` custom salvo `globals.css`.

### Imports

- Siempre usar el alias `@/*` → `src/*`. Nunca rutas relativas desde `src/`.

```typescript
// ✅ Correcto
import { prisma } from "@/lib/prisma";
// ❌ Incorrecto
import { prisma } from "../../lib/prisma";
```

### Lenguaje

- Todo string visible para el usuario **en español**.
- Variables, funciones, tipos y nombres de archivos en inglés/camelCase.

### React Compiler

- Está habilitado. **No usar `useMemo` ni `useCallback` manualmente**
  salvo que un profiling lo justifique explícitamente.

---

## Reglas de sesión de trabajo

### Commits

- **No hacer commit hasta que el módulo o sesión completa esté sin errores.**
- Verificar antes de commitear:
  - `npm run lint` pasa sin errores
  - `npm run build` compila sin errores de TypeScript
  - La funcionalidad trabajada se probó manualmente
- Un commit por módulo o unidad lógica completa, no por archivo suelto.
- Mensaje de commit en español, descriptivo:

```
  feat: agregar validación de VIN único por sucursal
  fix: corregir cálculo de saldo en pago con crédito
  refactor: mover lógica de cobro de taller a API route
```

### Antes de empezar cualquier tarea

1. Leer los archivos relevantes completos antes de editar.
2. Entender las dependencias del componente o módulo.
3. Si la tarea afecta datos financieros, confirmar el flujo completo
   antes de implementar.

### Al terminar cualquier tarea

1. Revisar que no queden `console.log`, `any`, ni `TODO` sin documentar.
2. Confirmar que `lint` y `build` pasan.
3. Solo entonces proceder al commit.
