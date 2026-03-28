# ANTIGRAVITY.MD - Contexto Técnico del Proyecto

## Información General
**Nombre del Proyecto:** evobike-pos2
**Descripción:** Sistema de Punto de Venta (POS) integral para EvoBike, diseñado para gestionar ventas, inventario multicanal (sucursales), administración de clientes y órdenes de servicio en taller. El sistema pone un fuerte énfasis en la precisión técnica y un diseño "premium" editorial.

## Stack Tecnológico
- **Framework:** Next.js 16.1.6 (App Router)
- **Lenguaje:** TypeScript 5.9
- **Frontend Core:** React 19.2.3
- **Estilos:** Tailwind CSS v4 (Alpha/Configuración nueva)
- **Base de Datos:** PostgreSQL (vía Docker)
- **ORM:** Prisma 6.19.2
- **Autenticación:** NextAuth 4.24.13 (Estrategia JWT, CredentialsProvider)
- **UI Components:** shadcn/ui (Radix UI)
- **Validación:** Zod
- **Formularios:** React Hook Form
- **Notificaciones:** Sonner (Toast)

## Arquitectura y Patrones
- **Organización de Rutas:**
  - `(auth)/`: Rutas públicas de autenticación (Login).
  - `(pos)/`: Rutas protegidas para la operación diaria. El layout principal verifica la sesión y redirige si no es válida.
- **Acceso a Datos:**
  - Los Server Components consumen Prisma directamente para lecturas.
  - Todas las mutaciones se realizan exclusivamente a través de **Server Actions** ubicados en `src/actions/`.
- **Aislamiento por Sucursal:** La mayoría de las entidades (`Sale`, `Stock`, `ServiceOrder`, `CashRegisterSession`) están vinculadas a un `branchId`. Las consultas deben filtrarse siempre por la sucursal del usuario en sesión, excepto para el rol `ADMIN`.
- **Estado de Sesión de Caja:** Un componente persistente `CashSessionManager` en el layout principal asegura que las operaciones de venta solo ocurran si hay una sesión de caja abierta.

## Estructura de Carpetas
- `prisma/`: Esquema de la base de datos y scripts de sembrado (`seed.ts`).
- `src/app/`: Estructura de rutas (Next.js App Router).
  - `(auth)/`: Flujo de login.
  - `(pos)/`: Dashboard, terminal de venta, inventario, clientes, taller, apartados.
- `src/actions/`: Lógica de negocio encapsulada en Server Actions (ej. `sale.ts`, `inventory.ts`).
- `src/components/`:
  - `ui/`: Componentes base de shadcn/ui.
  - `pos/`: Componentes específicos de la lógica de negocio del POS.
- `src/lib/`: Utilidades compartidas, configuración de Prisma (`prisma.ts`) y Auth (`auth.ts`).
- `public/`: Assets estáticos e imágenes de productos.

## Módulos Principales
1. **Punto de Venta (Terminal):** Interfaz para realizar ventas rápidas sincronizadas con la sesión de caja.
2. **Gestión de Inventario:** Control de productos (`ModeloConfiguracion`) con variantes por color y voltaje. Seguimiento de movimientos de stock.
3. **Taller (Workshop):** Gestión de órdenes de servicio con estados (PENDING → COMPLETED → DELIVERED).
4. **CRM / Clientes:** Registro de clientes, saldos a favor (crédito) y unidades (bicicletas/scooters) vinculadas mediante VIN.
5. **Caja (Cash Register):** Control de turnos, arqueos, entradas y salidas de efectivo.
6. **Apartados (Layaways):** Gestión de ventas con pagos parciales y reserva de productos.

## Estado Actual
- **Funcional:** Autenticación, estructura de sucursales, catálogo de productos, registro de ventas básicas, CRM de clientes, gestión de sesiones de caja.
- **En Progreso:** Integración profunda del flujo de taller con el inventario de refacciones, reportes de KPI en el dashboard.
- **Falta:** Sistema de alertas de stock mínimo automático, integraciones de pago externas (tarjetas crédito/débitp vía API), suite de pruebas automatizadas.

## Lógica de Negocio / Flujo de Datos
1. El usuario inicia sesión y se le asigna una sucursal (`branchId`).
2. Para vender, debe abrir una `CashRegisterSession`.
3. Una `Sale` descuenta automáticamente de `Stock` y genera un `InventoryMovement`.
4. Los pagos se registran como `CashTransaction` vinculadas a la sesión de caja y la venta.
5. En taller, una `ServiceOrder` puede consumir productos del inventario, lo que dispara movimientos de tipo `WORKSHOP_USAGE`.

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

## Decisiones Técnicas y Convenciones
- **Idioma:** Todos los textos de cara al usuario final deben estar estrictamente en Español.
- **Diseño "Kinetic Precision":** Dark mode por defecto, tipografía Space Grotesk para títulos, prohibido el uso de bordes sólidos de 1px (usar cambios de tono en superficies).
- **Mutaciones:** Prohibido el uso de rutas de API tradicionales para cambios de estado; usar siempre Server Actions.
- **React Compiler:** Habilitado para optimizar renderizados automáticamente.

## Deuda Técnica
- **Pruebas:** Ausencia total de Unit, Integration o E2E tests.
- **Validación Cruzada:** Riesgo de inconsistencias en saldos si fallan las transacciones de Prisma (se requiere mayor uso de `$transaction`).
- **Escalabilidad de Archivos:** Las acciones en `src/actions/` están creciendo agresivamente por módulo.

## Próximas Tareas
- Implementar validación de VIN única por sucursal.
- Refactorizar el flujo de pagos para soportar múltiples métodos en una sola transacción.
- Añadir sección de reportes de rentabilidad por sucursal.
