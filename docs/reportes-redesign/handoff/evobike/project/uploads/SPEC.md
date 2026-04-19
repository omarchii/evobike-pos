# Rediseño del Módulo de Reportes — Spec para Diseño

> **Estado:** Spec cerrado v1 · Diseño en Claude Design
> **Última actualización:** 2026-04-18
> **Owner:** Omar — evobike-pos2
> **Basado en:** mockups 2026-04-18 (índice con Vistas guardadas + 6 secciones)

---

## 0. Resumen para Claude Design

Hay que diseñar un módulo de reportes con **dos niveles**:

1. **Índice** (`/reportes`) — hub con "Vistas guardadas" arriba y 6 secciones de cards (VENTAS, CLIENTES, TALLER, INVENTARIO, FINANCIERO, EXPORTACIONES).
2. **Detalle de cada reporte** — página con filtros, KPIs, visualización principal, tabla y drill-down.

El resto del documento especifica **qué contiene cada reporte, cómo se estructura visualmente, y qué interacciones soporta**. No especifica endpoints ni schema — eso lo resuelve la implementación.

**Principios de diseño (heredados de DESIGN.md del proyecto):**
- Paleta verde evobike, light + dark mode.
- No-Line rule: tonalidad sobre borders. Usar `var(--surf-bright|high|low)` para separar zonas.
- Glassmorphism sutil (como command palette en sub-sesión 1-C).
- Densidad de información alta pero legible. Fuentes Inter (UI) + Space Grotesk (display).
- Evitar iconitos genéricos: cada reporte debe tener un glyph con carácter (Lucide + contención en cuadrado redondeado).
- Responsive: desktop primero, tablet ok, mobile solo lectura de KPIs (no tablas densas).

**13 reportes en v1 + 3 en v2. Total 16 cards a diseñar.**

---

## 1. Estructura del Índice

### 1.1 Layout general

```
┌─ Breadcrumb: Reportes ─────────────────────────────────────┐
│                                                             │
│  H1: Reportes                                               │
│  Subtítulo: "Vista consolidada del negocio"                 │
│                                                             │
│  ┌─ Toolbar sticky ──────────────────────────────────────┐ │
│  │ [Sucursal: LEO / AV135 / Consolidado]   [🔍 Buscar]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ VISTAS GUARDADAS ─────────────────────────────────────┐ │
│  │ [card] [card] [card] [card + "Nueva vista"]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  VENTAS                                         3 REPORTES  │
│  [card]  [card]  [card]                                    │
│                                                             │
│  CLIENTES                                       3 REPORTES  │
│  [card]  [card]  [card]                                    │
│                                                             │
│  ... etc                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Card de reporte — anatomía

```
┌─────────────────────────────────┐
│ [glyph]                    [🔖] │  ← bookmark toggle
│                                 │
│ Nombre del reporte              │  ← Inter 16 semibold
│ Descripción breve de 1-2 lineas │  ← Inter 14 regular, muted
│                                 │
│ ─────────────────────────────── │  ← hairline separator
│ Hace 2 min              62 regs │  ← meta: última actualización + N registros
└─────────────────────────────────┘
```

**Interacciones:**
- Click en card → navega a `/reportes/<slug>`.
- Click en 🔖 → toggle bookmark (no navega). Estado `bookmarked` se visualiza relleno verde.
- Hover: leve elevación + tint del glyph.
- Estado cargando (skeleton): shimmer en meta inferior.
- Estado sin datos: meta dice "Sin datos en rango".

### 1.3 Vistas guardadas — anatomía

Card más ancho que el de reporte, sin glyph grande, con bookmark prominente:

```
┌──────────────────────────────────────┐
│ 🔖  CEO · Semanal consolidado        │
│     5 métricas configuradas          │
│     [COMPARTIDO] opcional             │
└──────────────────────────────────────┘
```

Una vista guardada = un **preset de filtros + selección de reportes + sucursal**. Al hacer click abre un dashboard embebido con los reportes seleccionados ya filtrados.

**Permisos:**
- ADMIN puede marcar una vista como `COMPARTIDO` (visible al resto).
- MANAGER ve sus vistas + las compartidas.
- SELLER no tiene acceso al módulo de reportes salvo "Estado de cuenta" (card único).

**Estado vacío:** "Aún no tienes vistas guardadas. Configura filtros en un reporte y pulsa *Guardar vista*."

### 1.4 Toolbar sticky

- **Selector de sucursal**: segmented control `LEO | AV135 | Consolidado` (ADMIN); MANAGER solo ve su sucursal (chip estático).
- **Búsqueda global**: busca dentro de nombres de reportes + descripciones + métricas configuradas. Resalta match en amarillo suave.
- Al hacer scroll, la toolbar se vuelve flotante con glassmorphism.

---

## 2. Estructura de un Reporte (detalle)

Todas las páginas `/reportes/<slug>` comparten este shell:

```
┌─ Breadcrumb: Reportes > [Sección] > [Nombre] ──────────────┐
│                                                             │
│  H1: Nombre del reporte    [Guardar vista] [Exportar CSV]   │
│  Subtítulo descriptivo largo                                │
│                                                             │
│  ┌─ Panel de filtros ────────────────────────────────────┐ │
│  │  [Rango fecha] [Sucursal] [Filtros específicos…]     │ │
│  │  [Limpiar]                             [Aplicar]      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ KPIs (3-5 cards horizontales) ───────────────────────┐ │
│  │  [KPI]  [KPI]  [KPI]  [KPI]  [KPI]                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Visualización principal (gráfico / matriz) ──────────┐ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Tabla de datos ──────────────────────────────────────┐ │
│  │  Tabla con sort, búsqueda interna, expansión de fila  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Panel de filtros

- Rango de fecha con presets rápidos: Hoy · Ayer · Esta semana · Mes actual · Mes anterior · Trimestre · Año · Custom.
- Sucursal: heredada del índice pero overridable.
- Filtros específicos: chips que abren popovers multi-select.
- Botón `Guardar vista` aparece solo cuando hay filtros no-default aplicados.
- URL-params para compartir link con filtros aplicados.

### 2.2 KPI card — anatomía

```
┌────────────────────────┐
│ Ingreso neto           │  ← label, muted
│ $1,234,567             │  ← número, Space Grotesk 28 bold
│ ▲ 12.4% vs. ant.       │  ← delta con color (verde/rojo/gris)
│ ▁▂▃▅▆▇▅▃  sparkline    │  ← opcional
└────────────────────────┘
```

Deltas:
- Verde con flecha ▲ si es favorable.
- Rojo con flecha ▼ si es desfavorable.
- **El signo favorable depende del KPI** (ingresos ▲=bueno; mermas ▲=malo).
- Si no hay período anterior comparable, mostrar "— sin comparativo".

### 2.3 Tabla

- Header sticky al scroll vertical.
- Columnas numéricas alineadas a la derecha, tabular-nums.
- Sort por click en header; triple-estado (asc/desc/default).
- Búsqueda interna con input compacto arriba-derecha.
- Paginación 50 por página; infinite scroll en móvil.
- Fila expandible con chevron cuando aplica (drill-down in-place).
- Hover row: tint `var(--surf-high)`.
- Densidad compacta: 40-44px de alto por fila.

### 2.4 Estados comunes

- **Loading**: skeleton en KPIs + shimmer en gráfico + filas fantasma.
- **Sin datos en rango**: ilustración discreta + CTA "Ampliar rango" que abre selector.
- **Error**: card rojo pálido con mensaje + "Reintentar".
- **Sin permisos**: redirect con toast (no debería llegar a render).

---

## 3. Catálogo de Reportes — V1 (13 reportes)

Formato por reporte: **propósito → filtros → KPIs → vista principal → tabla → drill-down → export → roles → glyph sugerido**.

---

### VENTAS

#### V1. Ventas e ingresos

- **Propósito:** entender qué se vendió, cuánto se facturó y quién vendió en el período.
- **Filtros:** rango fecha, sucursal, vendedor, método de pago, tipo de venta (Producto / Servicio taller / Montaje).
- **KPIs (5):**
  1. Tickets emitidos
  2. Ingreso neto
  3. Ticket promedio
  4. Unidades vendidas
  5. % crecimiento vs. período anterior (comparable)
- **Visualización principal:**
  - Gráfico de líneas (ingreso diario/semanal según rango).
  - Overlay de barras apiladas por método de pago en el mismo eje X.
  - Toggle arriba-derecha: "Por día / Por semana / Por mes".
- **Tabla:** listado de tickets con columnas `folio · fecha · cliente · vendedor · tipo · método · total · margen`.
- **Drill-down:**
  - Click en punto del gráfico → filtra tabla al día.
  - Click en folio → modal con detalle del ticket.
  - Click en vendedor → navega a perfil de vendedor con sus tickets del rango.
- **Export:** CSV completo, incluye líneas de detalle opcionales.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** línea ascendente (`LineChart`).

---

#### V2. Margen bruto por producto

- **Propósito:** identificar qué SKUs generan el margen real del negocio, y cuáles están cerca de ser un lastre.
- **Filtros:** rango, sucursal, categoría, marca/proveedor, vendedor.
- **KPIs (4):**
  1. Ingreso neto del rango
  2. Costo total
  3. Margen bruto absoluto
  4. Margen % con sparkline MoM
- **Visualización principal:**
  - Scatter plot: eje X = unidades vendidas, eje Y = margen %, tamaño del punto = margen $ absoluto. Permite ver "alto volumen / bajo margen" vs. "bajo volumen / alto margen".
  - Debajo: barra horizontal apilada con contribución al margen total por top 10 SKUs.
- **Tabla:** `SKU · nombre · categoría · unidades · precio prom · costo prom · margen $ · margen % · contribución %`. Orden default por margen $ desc.
- **Alerta visual:** filas con margen % < umbral (configurable, default 15%) pintan en ámbar. SKU con margen negativo en rojo.
- **Drill-down:** click en fila → timeline de ventas del SKU + últimas recepciones (costo histórico).
- **Export:** CSV completo.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** flecha diagonal ascendente dentro de cuadro (`TrendingUp`).

---

#### V3. Comisiones por vendedor

- **Propósito:** liquidar comisiones y entender qué está empujando cada vendedor.
- **Filtros:** rango (default: mes actual), sucursal, vendedor, estado de liquidación (Pendiente / Liquidada).
- **KPIs (4):**
  1. Base total comisionable
  2. Comisión generada
  3. % efectivo promedio (comisión ÷ base)
  4. Vendedores con meta cumplida (si hay meta configurada)
- **Visualización principal:**
  - Barras horizontales por vendedor con segmentos coloreados por regla aplicada.
  - Línea de referencia vertical = comisión promedio del equipo.
- **Tabla:** `vendedor · sucursal · base · comisión · % efectivo · reglas aplicadas · tickets · acciones`.
- **Drill-down:** fila expandible → breakdown por regla: "Regla Venta General: $X sobre $Y | Regla Bici Premium: $X sobre $Y…".
- **Side-panel contextual:** "Reglas vigentes" con link a `/configuracion/comisiones` (la gestión de reglas se muda a Configuración, solo lectura aquí).
- **Export:** CSV formato nómina (una fila por vendedor, columna total neto).
- **Roles:** MANAGER (su sucursal) · ADMIN (cross).
- **Glyph:** símbolo de porcentaje estilizado / peso (`Coins` o custom `₡`).

---

### CLIENTES

#### V4. Apartados / Layaway

- **Propósito:** gestionar cobranza de pedidos parcialmente pagados y reducir apartados vencidos.
- **Filtros:** sucursal, antigüedad (bucket: 0-30 / 31-60 / 60+ / Todos), estado (Activo / Vencido / Liquidado).
- **KPIs (4):**
  1. Apartados activos (count)
  2. Saldo total pendiente ($)
  3. Apartados vencidos (count + % del total)
  4. Ticket promedio de apartado
- **Visualización principal:**
  - Donut chart con distribución por bucket de antigüedad.
  - Debajo: línea temporal de creación vs. liquidación en el rango.
- **Tabla:** `cliente · teléfono · fecha apartado · monto total · abonado · pendiente · % avance · antigüedad · próximo recordatorio · acciones`.
- **Fila expandible:** historial de abonos (fecha · monto · método · recibió).
- **Acciones inline:** botón "Recordatorio WhatsApp" que abre `wa.me/…` con plantilla prerellenada; botón "Marcar liquidado".
- **Badge de antigüedad:** verde (0-15d), amarillo (16-30d), ámbar (31-60d), rojo (60+).
- **Export:** CSV de cobranza (formato importable para Excel del gerente).
- **Roles:** SELLER (solo su sucursal) · MANAGER · ADMIN.
- **Glyph:** tarjeta de cuenta / bookmark (`Bookmark` o `CreditCard`).

---

#### V5. Retención y recompra

- **Propósito:** medir lealtad de clientes y detectar clientes que se están perdiendo.
- **Filtros:** rango (default: último año, ventana rodante), sucursal, cohorte (mes de primera compra).
- **KPIs (4):**
  1. Clientes activos en período
  2. % clientes recurrentes
  3. LTV promedio
  4. Días promedio entre compras
- **Visualización principal:**
  - **Matriz de cohortes**: filas = mes de primera compra, columnas = meses transcurridos (0, 1, 2, … 11). Celda pintada con intensidad de verde según % de retención. Hover muestra count absoluto.
  - Debajo: barras "Clientes nuevos vs. recurrentes" por mes.
- **Tabla lateral:** Top 15 clientes por LTV (nombre · primera compra · última compra · tickets · total gastado · frecuencia).
- **Drill-down:** click en celda de matriz → lista de clientes de esa cohorte con su actividad.
- **Nota v1:** NPS estimado del mockup queda fuera de v1 (requiere encuesta, no hay dato). Descripción del card debe decir solo "Clientes recurrentes, cohortes y LTV".
- **Export:** CSV matriz + CSV lista de clientes.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** flecha circular / retorno (`RotateCw` o `UserCheck`).

---

#### V6. Estado de cuenta (NUEVO — rescatar del original P10-B)

- **Propósito:** consultar deuda / crédito disponible de un cliente y su historial unificado.
- **Dos niveles:**
  - **Nivel 1** `/reportes/clientes`: tabla agregada.
  - **Nivel 2** `/reportes/clientes/[id]`: detalle por cliente.
- **Filtros (nivel 1):** sucursal, estado (Con saldo / Liquidado / Todos), antigüedad de la deuda.
- **KPIs (4):**
  1. Total por cobrar
  2. Clientes con saldo
  3. Vencido > 30 días
  4. Crédito total otorgado
- **Vista principal nivel 1:** tabla `cliente · tel · última compra · saldo actual · vencido · crédito disponible · acciones`.
- **Vista principal nivel 2:**
  - Cards resumen del cliente (teléfono, última visita, saldo, crédito, apartados activos).
  - Tabs: Ventas · Abonos · Apartados · Cotizaciones · Garantías (reusan P7-D patrón).
  - Timeline vertical con cada evento (compra/abono/apartado) con monto y saldo resultante.
- **Acción:** "Nuevo abono" abre modal que registra pago y actualiza saldo.
- **Export:** aging report (buckets 0-30 / 31-60 / 61-90 / 90+).
- **Roles:** SELLER · MANAGER · ADMIN (único card disponible para SELLER).
- **Glyph:** billetera (`Wallet`).

---

### TALLER

#### V7. Mantenimiento y fallas

- **Propósito:** entender el volumen de trabajo del taller, fallas recurrentes y seguimiento a clientes con mantenimiento vencido.
- **Filtros:** rango, sucursal, técnico asignado, tipo de OT (PAID / WARRANTY / COURTESY / POLICY_MAINTENANCE), modelo de bicicleta.
- **KPIs (5):**
  1. OTs activas ahora
  2. OTs completadas en período
  3. Tiempo promedio de ciclo (recepción → entrega)
  4. Tasa de retrabajos (re-ingresos dentro de 30d)
  5. % OTs por garantía
- **Visualización principal:**
  - Stacked bar horizontal: distribución por estado (PENDING / IN_PROGRESS / COMPLETED / DELIVERED).
  - Debajo: tabla "Top 10 fallas recurrentes" (descripción · count · tiempo promedio resolución · costo promedio refacciones).
- **Panel lateral "Mantenimientos pendientes"** (absorbe P11): bicis con `próximo mantenimiento` vencido o por vencer en 30d. Chip 🔴/🟡/🟢 + acción "Contactar cliente WhatsApp".
- **Drill-down:** click en falla → lista de OTs con esa falla; click en OT → ficha técnica.
- **Export:** CSV de OTs + CSV de mantenimientos pendientes.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** llave / wrench (`Wrench`).

---

#### V8. SLA y tiempos de respuesta

- **Propósito:** identificar cuellos de botella y monitorear cumplimiento de compromisos con el cliente.
- **Filtros:** rango, sucursal, técnico, tipo de OT, severidad (on-track / at-risk / breached).
- **KPIs (4):**
  1. % cumplimiento SLA
  2. Tiempo promedio recepción → entrega
  3. OTs fuera de SLA
  4. OT más antigua en curso (aging máximo)
- **Visualización principal:**
  - Histograma de duración por etapa: Recepción · Diagnóstico · Aprobación · Ejecución · QA · Entrega. Cada barra = tiempo promedio + p50/p90 como whiskers.
  - Gráfico secundario: cumplimiento SLA por día (% on-track vs. breached).
- **Tabla:** "OTs en riesgo ahora" — `folio · cliente · tipo · etapa · aging · SLA restante · técnico · acciones`. Ordenada por SLA restante ascendente (las más urgentes arriba).
- **Umbrales:** configurables por tipo de OT desde `/configuracion/taller` (fuera del scope de reportes).
- **Drill-down:** click en etapa del histograma → OTs lentas en esa etapa.
- **Export:** CSV de OTs con sus tiempos por etapa.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** reloj (`Clock`).
- **Dependencia:** requiere timestamps por `subStatus` (implementados en P13 Sub-fase A/D).

---

### INVENTARIO

#### V9. Stock y rotación

- **Propósito:** entender el capital en inventario, qué rota y qué está muerto.
- **Sub-tabs internos:** **Valorización** · **Rotación** · **Movimientos** (audit trail).
- **Filtros:** sucursal, categoría, proveedor, tipo (Bici / Accesorio / Refacción / Batería), rotación (Rápida / Media / Lenta / Muerta).
- **KPIs (5):**
  1. Valor total de inventario
  2. SKUs activos
  3. Rotación promedio (veces/año)
  4. Días de inventario (cobertura)
  5. Capital en stock lento (>180d sin venta)
- **Visualización principal (tab Valorización):**
  - Treemap por categoría: tamaño = valor $, color = rotación (verde rápida → rojo muerta).
- **Visualización principal (tab Rotación):**
  - Scatter: eje X = días en inventario, eje Y = velocidad venta/día, cuadrantes etiquetados ("Estrellas", "Estables", "Cola larga", "Muertos").
- **Visualización principal (tab Movimientos):**
  - Timeline con entradas/salidas recientes, agrupables por tipo (Recepción / Venta / Ajuste / Transferencia).
- **Tabla:** `SKU · nombre · categoría · stock actual · costo unit · valor · ventas 90d · rotación · días cobertura`.
- **Drill-down:** click en SKU → ficha con movimientos + últimas recepciones + ventas.
- **Export:** CSV por tab.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** caja 3D (`Package` o `Box`).

---

#### V10. Stock crítico

- **Propósito:** saber qué comprar hoy para evitar quiebres.
- **Filtros:** sucursal, categoría, severidad (Crítico / Bajo / Agotado / Todos).
- **KPIs (4):**
  1. SKUs bajo mínimo
  2. SKUs agotados
  3. Días promedio hasta quiebre (proyección)
  4. Valor sugerido de reposición
- **Visualización principal:**
  - Lista priorizada tipo "bandeja de entrada" con severidad visual: fila roja = agotado, ámbar = crítico (<3d), amarilla = bajo (<7d).
- **Tabla:** `SKU · stock actual · mínimo · velocidad venta/día · días restantes · último proveedor · último costo · sugerencia de compra (unidades)`.
- **Acción inline:** botón "Agregar a orden de compra" que acumula selección → abre wizard de recepción prellenado.
- **Vista alternativa:** agrupado por proveedor (para generar una OC por proveedor).
- **Export:** CSV lista de compra por proveedor.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** triángulo de alerta (`AlertTriangle`).

---

#### V11. Transferencias y mermas (NUEVO — rescatar P12-C)

- **Propósito:** monitorear movimientos entre sucursales y cuantificar pérdida en tránsito.
- **Tabs internos:** **Transferencias** · **Mermas**.
- **Filtros:** rango, sucursal origen, sucursal destino, estado (En tránsito / Recibida / Cancelada), folio.
- **KPIs tab Transferencias (4):**
  1. Transferencias en rango
  2. En tránsito ahora
  3. Recibidas
  4. Canceladas
- **KPIs tab Mermas (4):**
  1. Items con merma
  2. Unidades perdidas
  3. Costo de la merma ($)
  4. % merma global
- **Visualización tab Transferencias:**
  - Diagrama Sankey: origen → destino con grosor = # transferencias.
- **Visualización tab Mermas:**
  - Sub-tabs "Detalle / Por producto / Por sucursal" (patrón ya implementado).
  - Barras horizontales con top 10 productos con más merma.
- **Tabla:** `folio · fecha · origen → destino · items · estado · acciones`.
- **Export:** CSV por tab.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** flechas cruzadas (`ArrowLeftRight`).

---

### FINANCIERO

#### V12. P&L del período (absorbe Reporte Anual)

- **Propósito:** estado de resultados consolidado o por sucursal.
- **Filtros:** rango con presets potentes (Día · Semana · Mes · Trimestre · **Año** · YTD · Custom), sucursal, modo (Consolidado / Por sucursal comparado).
- **KPIs (5):**
  1. Ingresos
  2. Costo de ventas
  3. Margen bruto ($ y %)
  4. Gastos operativos
  5. Resultado neto
- **Visualización principal:**
  - Tabla P&L estructurada con secciones colapsables (patrón de hoja de Excel financiera):
    ```
    ▾ Ingresos                              $1,234,567
        Ventas de producto                   $980,000
        Servicios de taller                  $180,000
        Montaje                              $74,567
    ▾ (-) Costo de ventas                   $800,000
    = Margen bruto                           $434,567  (35.2%)
    ▾ (-) Gastos operativos                 $240,000
        Nómina                               $150,000
        Renta                                $40,000
        Servicios                            $25,000
        Otros                                $25,000
    = Resultado operativo                   $194,567  (15.8%)
    ```
  - Columna comparativa: **Período actual | Período anterior | Δ % | Mismo período año anterior | Δ %**.
- **Modo Por sucursal:** columnas LEO | AV135 | Consolidado lado a lado.
- **Preset "Anual ADMIN":** reemplaza completamente `reportes/anual` (gráficos mensuales, tendencia YoY, breakdown por sucursal).
- **Export:** Excel multi-hoja (una por sucursal + consolidado + anexos).
- **Roles:** MANAGER (su sucursal) · ADMIN (cross + anual).
- **Glyph:** barras verticales (`BarChart3`).

---

#### V13. Cashflow y tesorería

- **Propósito:** entender flujo de efectivo real, conciliación con banco y arqueo de caja.
- **Sub-tabs internos:** **Flujo** · **Historial de cortes** · **Conciliación**.
- **Filtros:** rango, sucursal, método (Efectivo / Tarjeta / Transferencia / ATRATO), tipo (Entrada / Salida).
- **KPIs tab Flujo (5):**
  1. Entradas del período
  2. Salidas del período
  3. Saldo neto
  4. Saldo bancario actual
  5. Efectivo en caja ahora (sesiones abiertas)
- **Visualización tab Flujo:**
  - Gráfico de cascada (waterfall): saldo inicial → entradas por método → salidas por categoría → saldo final.
  - Gráfico secundario: saldo acumulado día a día.
- **Tab Historial de cortes** (absorbe `reportes/caja/historial`):
  - Tabla `fecha · cajero · sucursal · apertura · teórico · real · diferencia · PDF`.
  - Badge de diferencia: verde (0), amarillo (<$50), rojo (>$50).
  - Link a comprobante PDF (P6-E).
- **Tab Conciliación:**
  - Tabla comparando saldo teórico calculado vs. `BankBalance` registrado.
  - Diferencias resaltadas.
- **Tabla tab Flujo:** movimientos cronológicos unificando `CashTransaction` + `OperationalExpense` (patrón P9).
- **Export:** CSV movimientos + PDF resumen ejecutivo del período.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** billete / cash (`Banknote` o `Wallet`).

---

#### V14. Cuentas por pagar + Compras a proveedor

- **Propósito:** gestionar pagos a proveedores y analizar comportamiento de compra.
- **Sub-tabs internos:** **Cuentas por pagar** · **Análisis de compras**.
- **Filtros:** proveedor, estado (Pendiente / Vencida / Próxima 7d / Próxima 30d / Pagada), rango vencimiento, forma de pago (Contado / Crédito / Transferencia).
- **KPIs tab Cuentas por pagar (4):**
  1. Total por pagar
  2. Vencido
  3. Próximos 7 días
  4. Próximos 30 días
- **KPIs tab Análisis (4):**
  1. Total comprado en período
  2. # proveedores activos
  3. Ticket promedio de compra
  4. Proveedor con mayor volumen
- **Visualización tab CxP:**
  - Aging chart: barras horizontales 0-30 / 31-60 / 61-90 / 90+.
  - Tabla `proveedor · folio recepción · fecha · monto · pagado · pendiente · vencimiento · días · estado (badge P10-G)`.
- **Visualización tab Análisis:**
  - Ranking de proveedores con barra horizontal de volumen + sparkline de tendencia.
  - Tabla agregada por proveedor: `proveedor · # recepciones · total comprado · pagado · pendiente · próximo vencimiento`.
- **Drill-down:** click en fila CxP → detalle de recepción; click en proveedor en Análisis → todas sus recepciones del rango.
- **Export:** CSV aging CxP + CSV análisis por proveedor.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** recibo / factura (`Receipt` o `FileText`).

---

### EXPORTACIONES

#### V15. Exportación contable

- **Propósito:** generar archivos para el contador externo sin intervención manual.
- **Filtros:** tipo de exportación (CFDI XML · Póliza mensual · Formato contador), rango, sucursal.
- **Vista principal:**
  - Wizard en 3 pasos:
    1. Tipo de exportación (cards seleccionables con preview del formato).
    2. Rango y alcance (sucursal, incluir canceladas, moneda).
    3. Revisión + generar.
  - Al generar: barra de progreso y al terminar, download + registro en historial.
- **Historial:** tabla `fecha · tipo · rango · sucursal · usuario · estado · descargar`. Últimas 50 exportaciones.
- **Alertas:** card de recordatorio "Última exportación mensual fue el 01-abr" si han pasado >35 días.
- **Roles:** ADMIN (y MANAGER si se configura).
- **Glyph:** flecha arriba con caja (`Upload` o `FileUp`).

---

## 4. Catálogo de Reportes — V2 (3 reportes adicionales)

Estos se diseñan en la misma sesión para tener el sistema completo, pero su implementación se difiere.

---

### V2.1 Funnel de cotizaciones — sección VENTAS

- **Propósito:** medir conversión de cotizaciones a ventas reales y detectar cotizaciones olvidadas.
- **Filtros:** rango, sucursal, vendedor, estado (DRAFT / SENT / ACCEPTED / CONVERTED / EXPIRED / REJECTED).
- **KPIs (5):**
  1. Cotizaciones emitidas
  2. Tasa de conversión global
  3. Tiempo promedio a cierre
  4. Pipeline abierto ($)
  5. Vencidas sin seguimiento
- **Visualización principal:**
  - Funnel vertical con 5 etapas (patrón sales funnel).
  - Debajo: ticket promedio cotizado vs. ticket promedio vendido.
- **Tabla:** cotizaciones abiertas ordenadas por antigüedad con owner y última acción.
- **Acciones inline:** "Dar seguimiento WhatsApp", "Convertir en venta".
- **Roles:** SELLER (propias) · MANAGER · ADMIN.
- **Glyph:** embudo (`Filter` o `FileCheck`).

---

### V2.2 Autorizaciones y descuentos — sección VENTAS (o FINANCIERO)

- **Propósito:** monitorear uso de autorizaciones especiales (descuentos, cancelaciones) para prevenir abuso y calibrar reglas.
- **Filtros:** rango, sucursal, solicitante, autorizador, decisión (Aprobada / Rechazada), motivo.
- **KPIs (4):**
  1. Solicitudes en período
  2. Tasa de aprobación
  3. Monto de descuento autorizado
  4. Tiempo promedio de aprobación
- **Visualización principal:**
  - Heatmap: solicitante (filas) × motivo (columnas) con count. Detecta patrones anómalos.
  - Línea temporal de solicitudes/día.
- **Tabla:** `solicitante · sucursal · motivo · monto · autorizador · decisión · tiempo · nota`.
- **Alerta:** resaltar solicitantes con >3 solicitudes en el período o >50% rechazadas.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** escudo con check (`ShieldCheck`).

---

### V2.3 NPS y satisfacción — sección CLIENTES

- **Propósito:** medir satisfacción real del cliente post-compra y post-taller.
- **Dependencia:** requiere infraestructura de encuesta (WhatsApp auto-message 3 días post-entrega, captura de respuesta). Fuera del alcance actual de código.
- **Filtros:** rango, sucursal, canal (Ventas / Taller).
- **KPIs (4):**
  1. NPS global
  2. Respuestas recibidas
  3. Tasa de respuesta
  4. Detractores sin seguimiento
- **Visualización principal:**
  - Big number NPS con colorbar de distribución (Detractor 0-6, Pasivo 7-8, Promotor 9-10).
  - Línea temporal del NPS mensual.
- **Tabla:** `cliente · canal · score · comentario · fecha · seguimiento`.
- **Acción:** marcar como contactado / escalar a gerente.
- **Roles:** MANAGER · ADMIN.
- **Glyph:** cara feliz / estrella (`Smile` o `Star`).

---

## 5. Decisiones cerradas para diseño

| # | Tema | Decisión |
|---|------|----------|
| 1 | Reglas de comisión | Se mudan a `/configuracion/comisiones` (gobierno). El reporte de comisiones solo enlaza. |
| 2 | Reporte anual | Desaparece como card independiente. Se absorbe como preset "Año" + modo "Consolidado ADMIN" en P&L. |
| 3 | Caja diario + historial | Se absorben como tabs dentro de "Cashflow y tesorería". |
| 4 | Compras a proveedor | Se mantiene como tab "Análisis de compras" junto a "Cuentas por pagar" en el mismo card. |
| 5 | Estado de cuenta | Es el único reporte accesible para SELLER. Se conserva como card dedicado en CLIENTES. |
| 6 | Vistas guardadas | Concepto v1 aunque requiera schema nuevo (`SavedReportView` + compartir con ADMIN). Se diseña ahora. |
| 7 | Sucursal en toolbar | Segmented control a nivel índice + overridable en cada reporte. URL-params. |
| 8 | Dark mode | Todo el módulo debe tener ambos themes. Verde primario se adapta. |
| 9 | Densidad por default | Compacta en desktop. Toggle "Cómoda / Compacta" opcional en v2. |
| 10 | Mobile | Índice navegable en mobile. Reportes individuales: mostrar KPIs + mensaje "Para ver tabla completa, abre en escritorio" en vez de renderizar tabla infumable. |

---

## 6. Lista de pantallas a diseñar

Para que Claude Design produzca mocks, necesito:

### 6.1 Pantallas núcleo (v1)

1. **Índice `/reportes`** — light + dark mode (2 mocks).
2. **Índice con sección Vistas guardadas expandida** y modal "Nueva vista guardada" (1 mock).
3. **Estado vacío** del índice (sin vistas guardadas, rol SELLER con solo un card).

### 6.2 Pantallas de reporte (v1 — 13 reportes)

Una pantalla por reporte. Cada una debe mostrar:
- Filtros aplicados.
- KPIs poblados.
- Visualización principal.
- Tabla con datos mock realistas.
- Al menos un estado de fila expandida / drill-down.

### 6.3 Pantallas adicionales

1. **Detalle de cliente** `/reportes/clientes/[id]` con tabs (Ventas / Abonos / Apartados / Cotizaciones / Garantías).
2. **Wizard de exportación contable** (3 pasos + confirmación).
3. **Modal "Guardar vista"** con selección de reportes y opción "Compartir con equipo".
4. **Estados de error / sin datos / loading** como conjunto de ejemplos.

### 6.4 Pantallas v2 (3 reportes)

Una pantalla por reporte, mismo nivel de detalle.

---

## 7. Handoff a Claude Code

Cuando el diseño esté cerrado, Claude Code necesita:

1. **Mocks en HTML/código** (patrón `docs/workshop-redesign/mocks/*/code.html`) — uno por pantalla.
2. **Tokens de color/espaciado utilizados** — confirmar que usan las CSS vars existentes.
3. **Inventario de componentes nuevos** que deban crearse vs. reusados (KPI card, sección header, filtros popover, tabla con fila expandible, etc.).
4. **Notas de comportamiento** que no se vean en el mock estático (hover states, transiciones, URL-params, shortcuts de teclado).
5. **Prioridad de implementación** recomendada (cuál reporte primero, cuál al final).

Con eso me puedes pasar el handoff y empiezo la implementación módulo por módulo (paso 2 del orden de pre-fase 6 en ROADMAP).

---

## 8. Fuera de alcance explícito

- **Gráficos animados / dashboards TV-mode**: fuera de v1. Diseñar pensando en datos estáticos con refresh manual.
- **Permisos granulares por columna**: no. Rol completo determina acceso a reportes.
- **Envío programado de reportes por email**: v3 o nunca.
- **Editor de reporte custom (tipo Metabase)**: fuera de scope. Los 16 reportes son el catálogo cerrado.
- **Comparativo multi-período libre (rango A vs. rango B con selector)**: v2 si el cliente lo pide.
