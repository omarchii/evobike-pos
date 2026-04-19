// Dashboard — 3 variants: editorial (Linear), stripe (financial), mercury (modular)

const KPICardEditorial = ({ kpi, hero = false, compareMode = false, chart = "line" }) => {
  if (hero) {
    return (
      <div className="kpi-hero fade-in" style={{ gridColumn: "span 2" }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="label-md" style={{ color: "rgba(255,255,255,0.75)" }}>{kpi.label}</span>
            <span style={{ fontSize: "0.625rem", background: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: 999, fontWeight: 600, letterSpacing: "0.05em" }}>DESTACADO</span>
          </div>
          <div className="display" style={{ fontSize: "2.75rem", color: "#fff", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
            {fmtMXN(kpi.value)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "rgba(255,255,255,0.85)", fontSize: "0.75rem" }}>
            <Delta value={kpi.delta} compact />
            <span>{kpi.sub}</span>
          </div>
          <div style={{ marginTop: "0.75rem", height: 56, marginLeft: -6, marginRight: -6 }}>
            <Sparkline data={kpi.series} color="#fff" height={56} />
          </div>
        </div>
      </div>
    );
  }

  const SparkEl = chart === "bars" ? SparkBars : Sparkline;
  const color = kpi.critical ? "var(--ter)" : kpi.warning ? "var(--warn)" : "var(--p-bright)";
  return (
    <div className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minHeight: 172 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="label-md">{kpi.label}</span>
        {kpi.critical && <Chip kind="crit" dot>Crítico</Chip>}
        {kpi.warning && <Chip kind="warn" dot>Atención</Chip>}
      </div>
      <div className="display" style={{ fontSize: "2.1rem", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {kpi.format === "count" ? fmtNum(kpi.value) : fmtMXN(kpi.value)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Delta value={kpi.delta} inverse={kpi.critical || kpi.warning} compact />
        <span style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{kpi.sub}</span>
      </div>
      <div style={{ marginTop: "auto", paddingTop: "0.6rem", height: 36, marginLeft: -6, marginRight: -6 }}>
        {kpi.splits
          ? <ProgressSplit splits={kpi.splits} total={kpi.value} />
          : <SparkEl data={kpi.series} color={color} height={36} />}
      </div>
    </div>
  );
};

const HeroBand = ({ kpiOrder, kpiVisibility, chartDefault, variant }) => {
  const kpis = kpiOrder.filter(id => kpiVisibility[id] !== false).map(id => EVOBIKE_DATA.KPIS[id]);
  const [hero, ...rest] = kpis;

  if (variant === "mercury") {
    // Modular — hero full-width + 4 KPIs horizontal band below
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0 1.5rem" }}>
        {hero && (
          <div className="kpi-hero fade-in" style={{ padding: "1.75rem 2rem" }}>
            <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2rem", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="label-md" style={{ color: "rgba(255,255,255,0.8)" }}>{hero.label}</span>
                  <span style={{ fontSize: "0.625rem", background: "rgba(255,255,255,0.18)", padding: "2px 8px", borderRadius: 999, fontWeight: 600, letterSpacing: "0.05em" }}>DESTACADO</span>
                </div>
                <div className="display" style={{ fontSize: "3.5rem", color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {fmtMXN(hero.value)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "rgba(255,255,255,0.88)", fontSize: "0.8125rem" }}>
                  <Delta value={hero.delta} compact />
                  <span>{hero.sub}</span>
                </div>
              </div>
              <div style={{ height: 96 }}>
                <Sparkline data={hero.series} color="#fff" height={96} />
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem" }}>
          {rest.slice(0, 4).map(k => <KPICardEditorial key={k.id} kpi={k} chart={chartDefault} />)}
        </div>
      </div>
    );
  }

  if (variant === "stripe") {
    // Financial — no hero, 5-col equal, numbers-first
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", padding: "0 1.5rem" }}>
        {kpis.slice(0, 5).map((k, i) => (
          <div key={k.id} className="card fade-in" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "1.25rem", background: i === 0 ? "var(--surf-low)" : "var(--surf-lowest)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label-md" style={{ fontSize: "0.5625rem" }}>{k.label}</span>
              <Delta value={k.delta} inverse={k.critical || k.warning} compact />
            </div>
            <div className="display" style={{ fontSize: "1.6rem", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
              {k.format === "count" ? fmtNum(k.value) : fmtMXN(k.value, { compact: true })}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{k.sub}</div>
            <div style={{ height: 28, marginTop: "0.4rem", marginLeft: -4, marginRight: -4 }}>
              <Sparkline data={k.series} color={k.critical ? "var(--ter)" : k.warning ? "var(--warn)" : "var(--p-bright)"} height={28} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Editorial Dense (default) — hero + 4 compact
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: "0.85rem", padding: "0 1.5rem" }}>
      {hero && <KPICardEditorial kpi={hero} hero chart={chartDefault} />}
      {rest.slice(0, 4).map(k => <KPICardEditorial key={k.id} kpi={k} chart={chartDefault} />)}
    </div>
  );
};

const TrendSection = ({ branch, chartDefault }) => {
  const data = EVOBIKE_DATA.dailySales;
  const prev = EVOBIKE_DATA.dailySalesPrev;
  const [view, setView] = React.useState(chartDefault === "bars" ? "bars" : "line");
  const [compare, setCompare] = React.useState(true);

  const branchData = branch === "all"
    ? data.map(d => ({ x: d.day, y: d.total, day: d.day, leo: d.leo, av135: d.av135 }))
    : data.map(d => ({ x: d.day, y: d[branch], day: d.day }));
  const prevData = compare && branch === "all"
    ? prev.map(d => ({ x: d.day, y: d.total }))
    : compare ? prev.map(d => ({ x: d.day, y: d[branch] })) : null;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Tendencia de ingresos</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>
            Diario · {branch === "all" ? "consolidado LEO + AV135" : `Sucursal ${branch.toUpperCase()}`} · {compare ? "vs. marzo" : "sin comparación"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button onClick={() => setCompare(!compare)} className="btn btn--sm"
            style={{ background: compare ? "var(--surf-high)" : "transparent", color: compare ? "var(--p)" : "var(--on-surf-var)" }}>
            <Icon name={compare ? "check" : "plus"} size={12} />
            Comparar
          </button>
          <div className="segmented">
            {[{k:"line", l:"Línea"},{k:"area",l:"Área"},{k:"bars", l:"Barras"}].map(o => (
              <button key={o.k} onClick={() => setView(o.k)}
                className={`segmented__btn ${view === o.k ? "segmented__btn--active" : ""}`}>{o.l}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ minHeight: 240 }}>
        {view === "bars" && branch === "all"
          ? <BarStack data={branchData} height={260} />
          : <LineArea data={branchData} compareData={prevData} fill={view !== "line"} height={260} />}
      </div>
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--ghost-border)" }}>
        <div>
          <div className="label-md">Ticket promedio</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
            {fmtMXN(Math.round(EVOBIKE_DATA.KPIS.ventasNetas.value / 69))}
          </div>
        </div>
        <div>
          <div className="label-md">Unidades vendidas</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>69</div>
        </div>
        <div>
          <div className="label-md">Días activos</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>18 / 18</div>
        </div>
        <div>
          <div className="label-md">Mejor día</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>Dom 12 · {fmtMXN(Math.max(...data.map(d => d.total)), { compact: true })}</div>
        </div>
      </div>
    </div>
  );
};

const BranchComparison = () => {
  const branches = EVOBIKE_DATA.BRANCH_COMPARISON;
  const maxSales = Math.max(...branches.map(b => b.sales));
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Comparativo de sucursales</h3>
        <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>Ventas netas MTD</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {branches.map(b => (
          <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: b.id === "leo" ? "#2ECC71" : "#52B788" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{b.name}</span>
                <Delta value={b.delta} compact />
              </div>
              <span className="display" style={{ fontSize: "0.9375rem", fontVariantNumeric: "tabular-nums" }}>{fmtMXN(b.sales)}</span>
            </div>
            <div style={{ height: 6, background: "var(--surf-high)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${(b.sales / maxSales) * 100}%`, height: "100%",
                background: b.id === "leo" ? "linear-gradient(90deg,#1b4332,#2ecc71)" : "var(--sec)",
                borderRadius: 999,
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>
              <span>{b.units} tickets</span>
              <span>Ticket ø {fmtMXN(b.ticket, { compact: true })}</span>
              <span>Margen {fmtPct(b.margin, 1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AlertsPanel = ({ onOpenThresholds }) => {
  const alerts = EVOBIKE_DATA.ALERTS_ACTIVE;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Alertas activas</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>{alerts.length} eventos · umbrales configurables</div>
        </div>
        <button className="btn btn--sm" onClick={onOpenThresholds} style={{ background: "var(--surf-high)", color: "var(--p)" }}>
          <Icon name="sliders" size={12} /> Umbrales
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {alerts.map(a => (
          <div key={a.id} style={{
            display: "flex", alignItems: "flex-start", gap: "0.6rem",
            padding: "0.6rem 0.75rem", borderRadius: "var(--r-md)",
            background: a.severity === "critical" ? "color-mix(in srgb, var(--ter) 10%, transparent)" : "color-mix(in srgb, var(--warn) 12%, transparent)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0,
              background: a.severity === "critical" ? "var(--ter)" : "var(--warn)",
              color: a.severity === "critical" ? "#fff" : "#2a1f00",
            }}>
              <Icon name="alert" size={14} stroke={2.25} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.35 }}>{a.title}</div>
              <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.6875rem", color: "var(--on-surf-var)", marginTop: 2 }}>
                <span>{a.module}</span>
                <span>·</span>
                <span>{a.time}</span>
              </div>
            </div>
            <button className="btn btn--icon" style={{ padding: 4 }}>
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TopProductsSection = () => {
  const products = EVOBIKE_DATA.TOP_PRODUCTS;
  const maxRev = Math.max(...products.map(p => p.revenue));
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Top productos por ingreso</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>MTD · ambas sucursales</div>
        </div>
        <button className="btn btn--sm" style={{ color: "var(--p)" }}>
          Ver todos <Icon name="arrowRight" size={12} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {products.map((p, i) => (
          <div key={p.name} style={{
            display: "grid", gridTemplateColumns: "24px 1fr auto 90px auto",
            gap: "0.75rem", alignItems: "center",
            padding: "0.55rem 0", borderTop: i === 0 ? "none" : "1px solid var(--ghost-border)",
          }}>
            <span className="label-md" style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)", marginTop: 1 }}>{p.units} uds · margen {fmtPct(p.margin)}</div>
            </div>
            <div style={{ width: 80, height: 6, background: "var(--surf-high)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${(p.revenue / maxRev) * 100}%`, height: "100%", background: "var(--p-bright)" }} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMXN(p.revenue, { compact: true })}</span>
            <button className="btn btn--icon" style={{ padding: 4 }}>
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const LowStockSection = () => {
  const items = EVOBIKE_DATA.LOW_STOCK;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Stock crítico</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>{items.length} items por debajo del mínimo</div>
        </div>
        <Chip kind="crit">47 críticos</Chip>
      </div>
      <div style={{ margin: "0 -0.5rem" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>SKU / producto</th>
              <th>Sucursal</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th style={{ textAlign: "right" }}>Mínimo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 6).map(it => (
              <tr key={it.sku}>
                <td>
                  <div style={{ fontWeight: 500 }}>{it.name}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}>{it.sku} · {it.cat}</div>
                </td>
                <td><Chip kind="neutral">{it.branch}</Chip></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {it.stock === 0 ? <span style={{ color: "var(--ter)" }}>0</span> : it.stock}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--on-surf-var)" }}>{it.min}</td>
                <td>{it.stock === 0 ? <Chip kind="nostock">Sin stock</Chip> : <Chip kind="crit">Bajo</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dashboard = ({ branch, kpiOrder, kpiVisibility, sections, variant, chartDefault, onOpenThresholds, setRoute }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "2rem" }}>
      {sections.hero !== false && <HeroBand kpiOrder={kpiOrder} kpiVisibility={kpiVisibility} chartDefault={chartDefault} variant={variant} />}

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "1rem", padding: "0 1.5rem" }}>
        {sections.trend !== false && <TrendSection branch={branch} chartDefault={chartDefault} />}
        {sections.branches !== false && <BranchComparison />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "0 1.5rem" }}>
        {sections.products !== false && <TopProductsSection />}
        {sections.alerts !== false && <AlertsPanel onOpenThresholds={onOpenThresholds} />}
      </div>

      {sections.lowstock !== false && (
        <div style={{ padding: "0 1.5rem" }}>
          <LowStockSection />
        </div>
      )}

      {sections.reports !== false && (
        <div style={{ padding: "0 1.5rem" }}>
          <ReportsQuickList setRoute={setRoute} />
        </div>
      )}
    </div>
  );
};

const ReportsQuickList = ({ setRoute }) => {
  const pinned = EVOBIKE_DATA.REPORTS_CATALOG.filter(r => r.pinned);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Reportes fijados</h3>
          <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>Acceso rápido · {pinned.length} reportes</div>
        </div>
        <button className="btn btn--sm" onClick={() => setRoute({ name: "list" })} style={{ color: "var(--p)" }}>
          Ver catálogo <Icon name="arrowRight" size={12} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "0.65rem" }}>
        {pinned.map(r => (
          <button key={r.id} onClick={() => setRoute({ name: "detail", report: r })}
            style={{
              display: "flex", flexDirection: "column", gap: "0.4rem",
              padding: "0.85rem 1rem", borderRadius: "var(--r-md)",
              background: "var(--surf-low)", textAlign: "left",
              transition: "background 120ms",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surf-high)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--surf-low)"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surf-lowest)", display: "grid", placeItems: "center", color: "var(--p)" }}>
                <Icon name={r.icon} size={14} />
              </div>
              <Icon name="bookmark" size={12} style={{ color: "var(--p-bright)" }} />
            </div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.15rem" }}>{r.title}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)", lineHeight: 1.4 }}>{r.desc}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "var(--on-surf-var)", marginTop: "0.2rem", letterSpacing: "0.03em" }}>
              <span>{r.updated}</span>
              {r.items != null && <span>{fmtNum(r.items)} regs</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard });
