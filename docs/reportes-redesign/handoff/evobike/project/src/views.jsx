// Reports list catalog view + Report detail view + Builder

const ReportsList = ({ setRoute, onExport }) => {
  const catalog = EVOBIKE_DATA.REPORTS_CATALOG;
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const groups = [...new Set(catalog.map(r => r.group))];

  const filtered = catalog.filter(r => {
    if (filter !== "all" && r.group !== filter) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase()) && !r.desc.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const grouped = groups.map(g => ({ group: g, items: filtered.filter(r => r.group === g) })).filter(x => x.items.length);

  return (
    <div style={{ padding: "0 1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="card card--dim" style={{ padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 240, background: "var(--surf-lowest)", outline: "1px solid var(--ghost-border)", borderRadius: 999, padding: "0.4rem 0.85rem" }}>
          <Icon name="search" size={14} style={{ color: "var(--on-surf-var)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar reportes por título o descripción..."
                 style={{ background: "transparent", border: "none", outline: "none", flex: 1, fontSize: "0.8125rem", color: "var(--on-surf)" }} />
        </div>
        <div className="segmented">
          <button onClick={() => setFilter("all")} className={`segmented__btn ${filter === "all" ? "segmented__btn--active" : ""}`}>Todos</button>
          {groups.map(g => (
            <button key={g} onClick={() => setFilter(g)} className={`segmented__btn ${filter === g ? "segmented__btn--active" : ""}`}>{g}</button>
          ))}
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setRoute({ name: "builder" })}>
          <Icon name="plus" size={14} />
          Nuevo reporte
        </button>
      </div>

      <div className="card card--dim" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Vistas guardadas</h3>
            <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>Configuraciones personales y compartidas</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
          {EVOBIKE_DATA.SAVED_VIEWS.map(v => (
            <button key={v.id} style={{
              display: "flex", flexDirection: "column", gap: "0.35rem",
              padding: "0.75rem 0.9rem", borderRadius: "var(--r-md)",
              background: "var(--surf-lowest)", textAlign: "left",
              outline: "1px solid var(--ghost-border)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Icon name="bookmark" size={14} style={{ color: "var(--p)" }} />
                {v.shared && <Chip kind="primary">Compartido</Chip>}
              </div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{v.name}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{v.metrics} métricas configuradas</div>
            </button>
          ))}
        </div>
      </div>

      {grouped.map(({ group, items }) => (
        <div key={group}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 0.25rem 0.6rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--on-surf-var)" }}>
              {group}
            </h3>
            <span className="label-md">{items.length} reportes</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.65rem" }}>
            {items.map(r => (
              <button key={r.id} onClick={() => setRoute({ name: "detail", report: r })}
                className="card" style={{
                  display: "flex", flexDirection: "column", gap: "0.55rem",
                  textAlign: "left", padding: "1.25rem",
                  transition: "transform 140ms ease, box-shadow 140ms ease",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0px 18px 40px -6px rgba(19,27,46,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surf-high)", color: "var(--p)", display: "grid", placeItems: "center" }}>
                    <Icon name={r.icon} size={18} />
                  </div>
                  {r.pinned && <Icon name="bookmark" size={14} style={{ color: "var(--p-bright)" }} />}
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.005em", marginTop: "0.2rem" }}>{r.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", lineHeight: 1.45, flex: 1 }}>{r.desc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.55rem", borderTop: "1px solid var(--ghost-border)" }}>
                  <span style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{r.updated}</span>
                  {r.items != null && (
                    <span style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)", fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.items)} regs</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const ReportDetail = ({ report, branch, onExport, onOpenThresholds }) => {
  const [tab, setTab] = React.useState("summary");
  const [branchFilter, setBranchFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selected, setSelected] = React.useState(null);

  const sales = EVOBIKE_DATA.SALES.filter(s => {
    if (branchFilter !== "all" && s.branch !== branchFilter.toUpperCase()) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const totalRevenue = sales.reduce((s, r) => s + r.total, 0);
  const totalMargin = sales.reduce((s, r) => s + r.margin, 0);

  return (
    <div style={{ padding: "0 1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.85rem" }}>
        {[
          { label: "Tickets", value: fmtNum(sales.length), delta: 0.089, sub: "vs. periodo anterior" },
          { label: "Revenue neto", value: fmtMXN(totalRevenue), delta: 0.124, sub: "IVA excluido" },
          { label: "Margen bruto", value: fmtMXN(totalMargin), delta: 0.096, sub: `${fmtPct(totalMargin/totalRevenue, 1)} blended` },
          { label: "Ticket promedio", value: fmtMXN(Math.round(totalRevenue / sales.length)), delta: 0.032, sub: "Sin outliers" },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: "1.15rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="label-md" style={{ fontSize: "0.5625rem" }}>{kpi.label}</span>
            <div className="display" style={{ fontSize: "1.6rem", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Delta value={kpi.delta} compact />
              <span style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + top sellers */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "1rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Evolución diaria</h3>
              <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>Tickets y revenue · comparado vs. marzo</div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: "var(--p-bright)" }} /> Actual
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, borderTop: "2px dashed var(--on-surf-var)" }} /> Marzo
              </span>
            </div>
          </div>
          <LineArea data={EVOBIKE_DATA.dailySales.map(d => ({ x: d.day, y: d.total }))}
                    compareData={EVOBIKE_DATA.dailySalesPrev.map(d => ({ x: d.day, y: d.total }))}
                    fill height={220} />
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Top vendedores</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {[
              { name: "A. Gómez", branch: "LEO", sales: 18, revenue: 612000, avatar: "AG" },
              { name: "R. Tzuc", branch: "AV135", sales: 14, revenue: 498000, avatar: "RT" },
              { name: "M. Canché", branch: "LEO", sales: 12, revenue: 421000, avatar: "MC" },
              { name: "L. Huchim", branch: "AV135", sales: 11, revenue: 372000, avatar: "LH" },
              { name: "D. Interián", branch: "LEO", sales: 9, revenue: 312000, avatar: "DI" },
            ].map((s, i) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surf-high)", color: "var(--p)", display: "grid", placeItems: "center", fontSize: "0.6875rem", fontWeight: 600 }}>{s.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{s.branch} · {s.sales} tickets</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>{fmtMXN(s.revenue, { compact: true })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Registros del período</h3>
            <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: 2 }}>{sales.length} ventas · click para drill-down</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div className="segmented">
              {["all", "leo", "av135"].map(b => (
                <button key={b} onClick={() => setBranchFilter(b)}
                  className={`segmented__btn ${branchFilter === b ? "segmented__btn--active" : ""}`}>
                  {b === "all" ? "Todas" : b.toUpperCase()}
                </button>
              ))}
            </div>
            <select className="input" style={{ width: "auto", padding: "0.4rem 0.65rem", fontSize: "0.75rem" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="COMPLETED">Completadas</option>
              <option value="LAYAWAY">Apartados</option>
              <option value="REFUNDED">Devoluciones</option>
            </select>
            <button className="btn btn--sm btn--ghost" onClick={onOpenThresholds}>
              <Icon name="alert" size={12} /> Alertas
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Sucursal</th>
                <th>Vendedor</th>
                <th>Pago</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Margen</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 30).map(s => (
                <tr key={s.id} onClick={() => setSelected(s)} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.75rem", color: "var(--p)" }}>{s.id}</td>
                  <td style={{ color: "var(--on-surf-var)" }}>{fmtDate(s.date)}</td>
                  <td>{s.customer}</td>
                  <td style={{ fontWeight: 500 }}>{s.product}</td>
                  <td><Chip kind="neutral">{s.branch}</Chip></td>
                  <td style={{ color: "var(--on-surf-var)" }}>{s.seller}</td>
                  <td style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>{s.payment}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtMXN(s.total)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--sec)" }}>{fmtMXN(s.margin, { compact: true })}</td>
                  <td>
                    {s.status === "COMPLETED" && <Chip kind="pos">Completada</Chip>}
                    {s.status === "LAYAWAY" && <Chip kind="warn">Apartado</Chip>}
                    {s.status === "REFUNDED" && <Chip kind="crit">Devolución</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.25rem", fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
          <span>Mostrando 1–{Math.min(30, sales.length)} de {sales.length}</span>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <button className="btn btn--icon"><Icon name="chevronLeft" size={14} /></button>
            <span style={{ padding: "0 0.5rem" }}>1 / {Math.ceil(sales.length/30)}</span>
            <button className="btn btn--icon"><Icon name="chevronRight" size={14} /></button>
          </div>
        </div>
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 440, height: "100%", background: "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
            backdropFilter: "blur(20px)", padding: "1.5rem", overflow: "auto",
            animation: "slideIn 220ms ease-out",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <span className="label-md">Venta</span>
                <h2 className="headline" style={{ margin: 0, fontSize: "1.25rem", fontVariantNumeric: "tabular-nums" }}>{selected.id}</h2>
              </div>
              <button className="btn btn--icon" onClick={() => setSelected(null)}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <DetailField label="Fecha" value={fmtDate(selected.date) + " 2026"} />
              <DetailField label="Sucursal" value={selected.branch} />
              <DetailField label="Cliente" value={selected.customer} />
              <DetailField label="Vendedor" value={selected.seller} />
              <DetailField label="Pago" value={selected.payment} />
              <DetailField label="Estado" value={selected.status} />
            </div>
            <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
              <div className="label-md" style={{ marginBottom: "0.35rem" }}>Producto</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{selected.product}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}>
                <div>
                  <div className="label-md">Total</div>
                  <div className="display" style={{ fontSize: "1.4rem" }}>{fmtMXN(selected.total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="label-md">Margen</div>
                  <div className="display" style={{ fontSize: "1.4rem", color: "var(--sec)" }}>{fmtMXN(selected.margin)}</div>
                </div>
              </div>
            </div>
            <button className="btn btn--primary" style={{ width: "100%", justifyContent: "center" }}>
              Ver ticket completo <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailField = ({ label, value }) => (
  <div className="card card--dim" style={{ padding: "0.65rem 0.85rem", boxShadow: "none", outline: "none" }}>
    <div className="label-md" style={{ fontSize: "0.5625rem" }}>{label}</div>
    <div style={{ fontSize: "0.8125rem", fontWeight: 500, marginTop: 2 }}>{value}</div>
  </div>
);

const Builder = ({ setRoute }) => {
  return (
    <div style={{ padding: "0 1.5rem 2rem" }}>
      <div className="card" style={{ padding: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,#1b4332,#2ecc71)", display: "grid", placeItems: "center", color: "#fff" }}>
          <Icon name="drag" size={32} stroke={2} />
        </div>
        <h2 className="headline" style={{ margin: 0, fontSize: "1.5rem" }}>Constructor de reportes</h2>
        <p style={{ maxWidth: 480, color: "var(--on-surf-var)", fontSize: "0.875rem", lineHeight: 1.55, margin: 0 }}>
          Arrastra métricas y dimensiones desde la biblioteca para construir un reporte personalizado. Guardalo como vista compartida o exportalo directamente.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button className="btn btn--ghost" onClick={() => setRoute({ name: "dashboard" })}>Volver al panel</button>
          <button className="btn btn--primary">
            <Icon name="plus" size={14} />
            Empezar desde cero
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div className="card card--dim">
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", fontWeight: 600 }}>Biblioteca</h4>
          <div className="label-md" style={{ marginBottom: "0.35rem" }}>Métricas</div>
          {["Revenue neto", "Margen bruto", "Ticket promedio", "Unidades vendidas", "Comisiones"].map(m => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem", borderRadius: 8, fontSize: "0.75rem", cursor: "grab" }}>
              <Icon name="drag" size={12} style={{ color: "var(--on-surf-var)" }} />
              {m}
            </div>
          ))}
          <div className="label-md" style={{ marginTop: "0.75rem", marginBottom: "0.35rem" }}>Dimensiones</div>
          {["Sucursal", "Vendedor", "Categoría", "Día", "Semana", "Forma de pago"].map(m => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem", borderRadius: 8, fontSize: "0.75rem", cursor: "grab" }}>
              <Icon name="drag" size={12} style={{ color: "var(--on-surf-var)" }} />
              {m}
            </div>
          ))}
        </div>
        <div className="card" style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem", border: "2px dashed var(--ghost-border)", boxShadow: "none", outline: "none" }}>
          <Icon name="plus" size={24} style={{ color: "var(--on-surf-var)" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>Arrastra aquí una métrica para empezar</div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ReportsList, ReportDetail, Builder });
