# ANTIGRAVITY.MD - Contexto Técnico del Proyecto

## Información General
**Nombre del Proyecto:** evobike-pos
**Descripción:** Sistema de Punto de Venta (POS) integral para EvoBike, diseñado para gestionar ventas, inventario multicanal (sucursales), administración de clientes, apartados/pedidos, trazabilidad de baterías y órdenes de servicio en taller. El sistema pone un fuerte énfasis en la precisión técnica y un diseño "premium" editorial.

## Stack Tecnológico
- **Framework:** Next.js 16.1.6 (App Router)
- **Lenguaje:** TypeScript 5.9
- **Frontend Core:** React 19.2.3
- **Estilos:** Tailwind CSS v4 (Alpha/Configuración nueva)
- **Base de Datos:** PostgreSQL 15+ (vía Docker)
- **ORM:** Prisma 6.19.2
- **Autenticación:** NextAuth 4.24.13 (Estrategia JWT, CredentialsProvider)
- **UI Components:** shadcn/ui (Radix UI)
- **Validación:** Zod
- **Formularios:** React Hook Form
- **Notificaciones:** Sonner (Toast)

## Estado de Fases y Roadmap

| Fase | Descripción | Estado |
|------|-------------|--------|
| **0** | Setup inicial, auth, estructura | ✅ Completo |
| **1A** | Catálogo & variantes (`ProductVariant`) | ✅ Completo |
| **1B** | POS Terminal básico + flujo de venta | ✅ Completo |
| **1.5** | Sistema de diseño EvoFlow aplicado | ✅ Completo |
| **1C** | Schema baterías, comisiones, catálogo servicios | ✅ Completo |
| **2 (parcial)** | Módulos de inventario, taller, clientes | ✅ Parcial |
| **2F** | **Modales de pago avanzados** | 🔄 En progreso (fix migración) |
| **2F.5** | **Historial de Ventas** (consulta por folio, filtros por fecha/vendedor/método de pago, detalle de venta) | ⏳ Pendiente |
| **2F.6** | **Cliente obligatorio en POS** — modal de selección/creación con campos completos (teléfono, dirección flete, datos de facturación) | ⏳ Pendiente |
| **2G** | **Módulo Pedidos** (Layaway + Backorder) | ⏳ Pendiente |
| **2H** | **Módulo de montaje** (requiere Opus) | ⏳ Pendiente |
| **3** | Cotizaciones | ⏳ Pendiente |
| **4** | Taller completo (cobro + stock) | ⏳ Pendiente |
| **5** | Reportes y comisiones | ⏳ Pendiente |
| **6** | Cierre / producción | ⏳ Pendiente |

## Arquitectura y Patrones
- **Organización de Rutas:**
  - `(auth)/`: Rutas públicas de autenticación (Login).
  - `(pos)/`: Rutas protegidas para la operación diaria. El layout principal verifica la sesión y redirige si no es válida.
- **Acceso a Datos:**
  - Los Server Components consumen Prisma directamente para lecturas.
  - Todas las mutaciones se realizan usando **API Routes (`src/app/api/`)** consumidas vía `fetch` desde componentes cliente, lo que garantiza el aislamiento adecuado, reemplazando el uso de Server Actions.
  - El proceso de migrar los *Server Actions a API routes* constituye *deuda técnica a saldar para la Fase 2H*.
- **Aislamiento por Sucursal:** La mayoría de las entidades (`Sale`, `Stock`, `ServiceOrder`, `CashRegisterSession`) están vinculadas a un `branchId`. Las consultas deben filtrarse siempre por la sucursal del usuario en sesión, excepto para el rol `ADMIN`.
- **Estado de Sesión de Caja:** Un componente persistente `CashSessionManager` en el layout principal asegura que las operaciones de venta solo ocurran si hay una sesión de caja abierta.
- **Transaccionalidad:** Se aplica `prisma.$transaction()` en todas las mutaciones que involucran múltiples tablas para asegurar consistencia ACID (ej. stock y caja en una venta).

## Decisiones Arquitectónicas Recientes
- **Folios secuenciales ($transaction):** Las ventas utilizan un folio secuencial generado por sucursal (ej. `LEO-0001`). Esto se hace utilizando un campo `lastSaleFolioNumber` atómico en el modelo `Branch`.
- **Mapeo de ProductVariant (`@@map`):** Prisma `ProductVariant` interactúa con la base de datos bajo el nombre `ModeloConfiguracion` a través del mapeo `@@map` evitando migraciones de renombre destructivas.
- **Pedidos unificados (Fase 2G):** Apartado (Layaway) y Pedido por encargo (Backorder sin stock) pasan a ser agrupados en un solo submódulo con pagos parciales y abonos para simplificación de UX.
- **Módulo de montaje con Opus (Fase 2H):** El ensamblaje de la bicicleta con la batería requiere integraciones complejas entre inventario, trazabilidad de voltaje y órdenes de ensamblaje. Su diseño deberá ser tratado de la mano con Claude Opus.

## Estructura de Carpetas
- `prisma/`: Esquema de la base de datos y scripts de sembrado (`seed.ts`, carpetas CSV `data/`).
- `src/app/`: Estructura de rutas (Next.js App Router).
  - `(auth)/`: Flujo de login.
  - `(pos)/`: Dashboard, terminal de venta, inventario, clientes, taller, layaways/pedidos.
  - `api/`: API Routes consumidas para mutaciones (en progreso de migración) y validación de NextAuth.
- `src/actions/`: *(Legacy, en proceso de migración)* Lógica de negocio de mutaciones.
- `src/components/`:
  - `ui/`: Componentes base de shadcn/ui.
  - `pos/`: Componentes específicos de la lógica de negocio del POS.
- `src/lib/`: Utilidades compartidas, configuración de Prisma (`prisma.ts`) y Auth (`auth.ts`).
- `public/`: Assets estáticos e imágenes de productos.

## Módulos Principales del Schema (Prisma)
1. **Catálogo & Inventario:** `Modelo`, `Color`, `Voltaje`, `ProductVariant` (antes `ModeloConfiguracion`), `Stock` e `InventoryMovement`.
2. **Ventas y Caja:** `Sale` (status `SaleType`, `LAYAWAY`, etc.), `SaleItem`, `CashRegisterSession` y `CashTransaction` (Múltiples métodos, incluyendo `ATRATO`).
3. **CRM / Clientes:** Registro de `Customer` con `balance` (crédito), `CustomerBike` (Vehículos por `VIN`) y logs de cambios `VoltageChangeLog`.
4. **Taller y Servicios:** `ServiceOrder`, `ServiceOrderItem` Kanban (PENDING → IN_PROGRESS → COMPLETED → DELIVERED → CANCELLED) y `ServiceCatalog` (refacciones / mano de obra).
5. **Comisiones:** `CommissionRule` y los registros `CommissionRecord` para cada vendedor/técnico.
6. **Baterías y Ensamblaje (Fase 1C):** Trazabilidad completa con `BatteryConfiguration`, `BatteryLot`, `Battery`, registro de asignaciones `BatteryAssignment` en bicis, y órdenes `AssemblyOrder`.

## Diseño visual: EvoFlow Green Edition
- El proyecto utiliza **EvoFlow Green Edition**, un sistema dual (light/dark mode).
- Estilos base mediante tokens CSS var/custom properties en `globals.css` (`--color-*`).
- **Verde Principal:** `oklch(0.55 0.18 145)` (dark), `oklch(0.40 0.18 145)` (light).
- **Tipografías:** `Inter` (cuerpo de texto) y `Space Grotesk` (encabezados y números).
- Superficies y modales usan efectos *glassmorphism* cuidando contraste, logrando diferencias en elevación sin utilizar bordes sólidos estáticos de 1px.
- Actualmente se puede ver implementado principalmente en `pos-terminal.tsx`.

## Variables de Entorno
- `DATABASE_URL`: Conexión a PostgreSQL.
- `NEXTAUTH_URL`: URL base de la aplicación.
- `NEXTAUTH_SECRET`: Llave para encriptar tokens JWT.

## Comandos Clave
- `docker-compose up -d`: Iniciar base de datos.
- `npm run dev`: Servidor de desarrollo.
- `npx prisma migrate dev`: Aplicar cambios de esquema.
- `npx prisma db seed`: Poblar base de datos inicial.
- `npm run build`: Generar build de producción.

## Deuda Técnica Conocida
- **Migración a API Routes:** Server actions legacy en el repositorio necesitan migrarse al estandar acordado (API Routes via fetch) antes de empezar la fase de ensamble (Fase 2H).
- **Pruebas:** Ausencia total de Unit, Integration o E2E tests, un riesgo alto en datos financieros.
- **Validación Cruzada en Taller:** La entrega actual de una orden de taller no descuenta productos de refacción en el inventario final, ni genera un `CashTransaction` al pagar (Fase 4 programada).

## Próximas Tareas Inmediatas
- Resolver el bug / drift en la migración de la base de datos necesario para los modales avanzados de pago (Fase 2F).
- Rediseño modular para habilitar múltiples métodos de pago en una sola compra.
- Crear módulo visual de pedidos (Backorders + Apartados LAYAWAY) en la Fase 2G.
