# Dashboard Redesign — Design Spec
**Date:** 2026-03-27
**Scope:** Layout shell, Sidebar, Topbar, Dashboard page
**Approach:** Opción A — Rediseño completo del layout POS

---

## 1. Goal

Replicar el diseño del screenshot de referencia (Kinetic ERP dashboard) aplicando el colorway de `DESIGN.md` ("Kinetic Precision" / "Deep Forest"), conservando el logo de Evobike, los módulos existentes, y toda la lógica de datos actual sin cambios destructivos.

---

## 2. Files Affected

| File | Change |
|------|--------|
| `src/app/(pos)/layout.tsx` | Agregar topbar, reestructurar flex layout |
| `src/app/(pos)/sidebar.tsx` | Rediseño visual completo |
| `src/app/(pos)/dashboard/page.tsx` | Rediseño de cards + paneles, 2 queries nuevas |

No se crean nuevos componentes — todo vive en los archivos existentes.

---

## 3. Design Tokens (DESIGN.md)

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#131313` | Base de toda la app |
| Sidebar bg | `#0d0d0d` | Sidebar ligeramente más oscuro |
| Primary | `#a5d0b9` | Texto activo, íconos, chips |
| Primary Container | `#1B4332` | Item activo en nav, card destacada |
| Secondary | `#E63946` | Badges de alerta/urgente |
| Tertiary | `#94ccff` | Datos técnicos, badges info |
| Surface container | `#1e1e1e` | Cards normales |
| Surface container high | `#2a2a2a` | Cards hover / nested |
| Text primary | `#f5f5f5` | Texto principal |
| Text muted | `#71717a` | Texto secundario (zinc-500) |

**Reglas DESIGN.md aplicadas:**
- Sin bordes 1px — separación solo por cambio de fondo
- Glassmorphism en topbar: `backdrop-blur-md bg-[#131313]/80`
- Esquinas: `rounded-2xl` (cards) / `rounded-full` (chips, badges)
- Tipografía: Space Grotesk (headlines) + Inter (body) — ambas ya disponibles en el proyecto o se agregan vía `next/font`
- Sin drop shadows estándar — usar `shadow-[0_8px_32px_rgba(0,0,0,0.4)]` para elementos flotantes

---

## 4. Layout Shell (`layout.tsx`)

**Antes:**
```
flex row → [Sidebar | Main (overflow-y-auto)]
```

**Después:**
```
flex row → [Sidebar | flex col → [Topbar (sticky) | Main (flex-1 overflow-y-auto)]]
```

```tsx
<div className="flex h-screen overflow-hidden bg-[#131313]">
  <Sidebar user={session.user} />
  <div className="flex flex-col flex-1 overflow-hidden">
    <Topbar user={session.user} />
    <main className="flex-1 overflow-y-auto relative">
      <div className="p-8">{children}</div>
      <CashSessionManager />
    </main>
  </div>
</div>
```

El `Topbar` es un nuevo componente inline en `layout.tsx` (no archivo separado, para no generar archivos innecesarios).

---

## 5. Sidebar (`sidebar.tsx`)

### Visual
- Fondo: `bg-[#0d0d0d]`
- Sin borde derecho visible — la diferencia de fondo separa del contenido
- Logo: solo `<Image src="/evobike-logo.webp">` — sin subtítulo de texto
- Íconos: color unificado `#a5d0b9` para todos los nav items
- Item activo: `bg-[#1B4332] text-[#a5d0b9]`, esquinas `rounded-xl`
- Item inactivo: `text-zinc-500 hover:text-zinc-200 hover:bg-white/5`

### Footer
- Avatar + nombre + rol/sucursal (igual que ahora)
- Botón "Cerrar Sesión" con estilo outline oscuro
- Separado del nav por spacing, sin línea divisoria

---

## 6. Topbar (nuevo, inline en `layout.tsx`)

Componente `Topbar` client component (necesita `useSession` o recibe `user` como prop desde el server layout).

**Estructura:**
```
[BranchChip]          [SearchInput]          [Bell | Settings | Help | Avatar]
```

### BranchChip
```tsx
<div className="bg-[#1B4332] text-[#a5d0b9] px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest">
  BRANCH: {user.branchName}
</div>
```

### SearchInput
```tsx
<div className="relative w-80">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
  <input placeholder="Buscar órdenes, VIN…" className="w-full bg-[#1e1e1e] rounded-2xl pl-9 pr-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-[#a5d0b9]/30" />
</div>
```
Sin funcionalidad de búsqueda — solo visual.

### Íconos derechos
- `Bell`, `Settings` (→ `/settings`), `HelpCircle` — `text-zinc-500 hover:text-zinc-300`
- Avatar con iniciales del usuario, fondo `#1B4332`

### Glassmorphism
```css
backdrop-blur-md bg-[#131313]/80 border-b border-white/5
```

---

## 7. Dashboard Page (`dashboard/page.tsx`)

### Queries nuevas (no rompen lógica existente)
```ts
// Conteo de ventas completadas hoy
const salesTodayCount = await prisma.sale.count({
  where: { branchId, status: "COMPLETED", createdAt: { gte: startOfToday, lte: endOfToday } }
});

// Próximas órdenes de taller (3)
const upcomingOrders = await prisma.serviceOrder.findMany({
  where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
  orderBy: { createdAt: 'asc' },
  take: 3,
  include: { customer: true }
});
```

### 4 Metric Cards

Layout: `grid grid-cols-4 gap-4`

| # | Título | Valor | Estilo |
|---|--------|-------|--------|
| 1 | Ventas Hoy | `salesTodayCount` unidades | Surface `#1e1e1e` |
| 2 | **Ingresos del Día** | `$revenueToday` | **Destacada** `bg-[#1B4332]`, texto grande |
| 3 | Taller Activo | `activeWorkshopCount` órdenes | Surface `#1e1e1e` |
| 4 | Apartados Activos | `activeLayawaysCount` tickets | Surface `#1e1e1e` |

Card destacada (Ingresos) ocupa visualmente más espacio vertical — mismo ancho en grid pero con padding extra y valor en `text-4xl font-bold text-[#a5d0b9]`.

### Zona principal (grid 7 cols)

**Col 1-4: Revenue Trend**
- Card `bg-[#1e1e1e] rounded-2xl`
- Header: "Tendencia de Ingresos" + descripción
- Toggle visual Semana/Mes (sin funcionalidad)
- Placeholder `h-64` con texto "El gráfico se activará en v2"

**Col 5-7: dos paneles apilados**

Panel A — **Ventas Recientes** (últimas 5)
- Cada fila: Avatar con iniciales del cliente + nombre + folio + badge status + monto en `#a5d0b9`

Panel B — **Próximas Órdenes de Taller** (3 más recientes PENDING/IN_PROGRESS)
- Cada fila: fecha chip (día/mes) + descripción/cliente + badge de status (PENDING = zinc, IN_PROGRESS = `#94ccff`)

---

## 8. Typography

Agregar `Space_Grotesk` vía `next/font/google` en `layout.tsx` raíz (o en el POS layout). Aplicar a headings del dashboard con `font-display` utility class o directamente en className.

---

## 9. What Does NOT Change

- Lógica de todas las server actions (`sale.ts`, `workshop.ts`, etc.)
- Rutas y navegación
- Autenticación y sesión
- `CashSessionManager` overlay
- Todos los demás módulos (POS, Inventario, Taller, etc.) — solo se benefician del nuevo layout/topbar
- Componentes shadcn en `src/components/ui/`
