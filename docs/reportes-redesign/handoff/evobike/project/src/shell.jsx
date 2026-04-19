// Shell: Sidebar + Topbar + layout

const NAV_ITEMS = [
  { group: "OPERACIONES", items: [
    { id: "inicio", label: "Inicio", icon: "dashboard" },
    { id: "punto-venta", label: "Punto de Venta", icon: "sales" },
    { id: "pedidos", label: "Pedidos", icon: "box" },
    { id: "taller", label: "Taller Mecánico", icon: "wrench" },
    { id: "montaje", label: "Montaje", icon: "bike" },
  ]},
  { group: "GESTIÓN", items: [
    { id: "clientes", label: "Clientes", icon: "user" },
    { id: "inventario", label: "Inventario", icon: "box" },
    { id: "cotizaciones", label: "Cotizaciones", icon: "invoice" },
    { id: "transferencias", label: "Transferencias", icon: "share" },
    { id: "reportes", label: "Reportes", icon: "report", active: true, badge: 13 },
  ]},
  { group: "ADMIN", items: [
    { id: "caja", label: "Caja", icon: "cash" },
    { id: "tesoreria", label: "Tesorería", icon: "pnl" },
    { id: "autorizaciones", label: "Autorizaciones", icon: "check" },
    { id: "configuracion", label: "Configuración", icon: "sliders" },
  ]},
];

const Sidebar = ({ collapsed, onToggle }) => {
  return (
    <aside style={{
      width: collapsed ? 64 : 232,
      background: "var(--surf-low)",
      transition: "width 180ms ease",
      display: "flex", flexDirection: "column",
      flexShrink: 0,
      padding: "1rem 0.75rem",
      height: "100vh", position: "sticky", top: 0,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0.5rem 1rem", gap: 8 }}>
        {!collapsed ? <Logo size={22} /> : (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1b4332,#2ecc71)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 14 }}>E</div>
        )}
      </div>

      <nav style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {NAV_ITEMS.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <div className="label-md" style={{ padding: "0 0.75rem", marginBottom: "0.35rem", fontSize: "0.5625rem", opacity: 0.75 }}>
                {group.group}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.items.map(item => (
                <button key={item.id} style={{
                  display: "flex", alignItems: "center", gap: "0.625rem",
                  padding: collapsed ? "0.5rem" : "0.5rem 0.75rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: item.active ? 600 : 500,
                  color: item.active ? "var(--p)" : "var(--on-surf-var)",
                  background: item.active ? "var(--surf-high)" : "transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                  textAlign: "left", width: "100%",
                  transition: "background 120ms, color 120ms",
                }} title={collapsed ? item.label : undefined}>
                  <Icon name={item.icon} size={16} stroke={item.active ? 2 : 1.75} />
                  {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  {!collapsed && item.badge != null && (
                    <span style={{
                      background: "linear-gradient(135deg,#1b4332,#2ecc71)",
                      color: "#fff", fontSize: "0.625rem", fontWeight: 600,
                      padding: "1px 6px", borderRadius: 999,
                    }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.625rem", borderRadius: 12, background: "transparent" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--p-container)", color: "var(--on-p-container)", display: "grid", placeItems: "center", fontWeight: 600, fontSize: "0.75rem", flexShrink: 0 }}>N</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin General</div>
            <div style={{ fontSize: "0.625rem", color: "var(--on-surf-var)" }}>2 sucursales</div>
          </div>
        )}
      </div>
    </aside>
  );
};

const Topbar = ({ branch, setBranch, dark, setDark, onOpenTweaks, route, setRoute, period, setPeriod }) => {
  const crumbs = [
    { label: "Gestión", href: null },
    { label: "Reportes", href: "list" },
    ...(route.name === "detail" ? [{ label: route.report?.title || "Detalle" }] : []),
    ...(route.name === "builder" ? [{ label: "Constructor" }] : []),
  ];

  return (
    <header style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.75rem 1.5rem",
      background: "var(--surface)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div className="segmented" style={{ padding: 2 }}>
          {EVOBIKE_DATA.BRANCHES.map(b => (
            <button key={b.id}
              onClick={() => setBranch(b.id)}
              className={`segmented__btn ${branch === b.id ? "segmented__btn--active" : ""}`}>
              {b.name}
            </button>
          ))}
          <button onClick={() => setBranch("all")}
            className={`segmented__btn ${branch === "all" ? "segmented__btn--active" : ""}`}>
            Consolidado
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", maxWidth: 520, margin: "0 auto" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: "var(--surf-lowest)",
          outline: "1px solid var(--ghost-border)",
          borderRadius: 999, padding: "0.4rem 0.85rem", width: "100%",
        }}>
          <Icon name="search" size={14} style={{ color: "var(--on-surf-var)" }} />
          <input placeholder="Buscar reportes, métricas, SKUs..."
                 style={{ background: "transparent", border: "none", outline: "none", flex: 1, fontSize: "0.8125rem", color: "var(--on-surf)" }} />
          <kbd style={{ fontSize: "0.625rem", color: "var(--on-surf-var)", background: "var(--surf-high)", padding: "1px 6px", borderRadius: 4 }}>⌘K</kbd>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <button className="btn btn--icon" title="Notificaciones" style={{ position: "relative" }}>
          <Icon name="bell" size={17} />
          <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 999, background: "var(--ter)", outline: "2px solid var(--surface)" }} />
        </button>
        <button className="btn btn--icon" onClick={() => setDark(!dark)} title={dark ? "Light mode" : "Dark mode"}>
          <Icon name={dark ? "sun" : "moon"} size={17} />
        </button>
        <button className="btn btn--icon" onClick={onOpenTweaks} title="Tweaks">
          <Icon name="sliders" size={17} />
        </button>
      </div>
    </header>
  );
};

// Breadcrumbs row (below topbar)
const PageHeader = ({ route, setRoute, period, setPeriod, onExport, branch }) => {
  const titles = {
    list: { title: "Reportes", sub: "13 reportes disponibles · vista global de todas las sucursales" },
    dashboard: { title: "Panel de reportes", sub: "Vista global — consolidada y por sucursal · MTD · abril 2026" },
    detail: { title: route.report?.title || "Detalle", sub: route.report?.desc },
    builder: { title: "Constructor de reportes", sub: "Arrastra métricas y dimensiones — preview en vivo" },
  };
  const t = titles[route.name] || titles.dashboard;
  const branchLabel = branch === "all" ? "Todas las sucursales" : `Sucursal ${branch.toUpperCase()}`;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", padding: "0.5rem 1.5rem 1rem", flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
          <button onClick={() => setRoute({ name: "dashboard" })} style={{ color: "inherit", fontSize: "0.75rem" }}>Gestión</button>
          <Icon name="chevronRight" size={12} />
          <button onClick={() => setRoute({ name: "dashboard" })} style={{ color: "inherit", fontSize: "0.75rem" }}>Reportes</button>
          {route.name === "detail" && route.report && (
            <>
              <Icon name="chevronRight" size={12} />
              <span style={{ color: "var(--on-surf)", fontWeight: 500 }}>{route.report.title}</span>
            </>
          )}
          {route.name === "list" && (
            <>
              <Icon name="chevronRight" size={12} />
              <span style={{ color: "var(--on-surf)", fontWeight: 500 }}>Catálogo</span>
            </>
          )}
          {route.name === "builder" && (
            <>
              <Icon name="chevronRight" size={12} />
              <span style={{ color: "var(--on-surf)", fontWeight: 500 }}>Constructor</span>
            </>
          )}
        </div>
        <h1 className="headline" style={{ fontSize: "1.75rem", margin: 0, marginBottom: "0.2rem" }}>{t.title}</h1>
        <div style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>{t.sub}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <div className="segmented">
          {["Hoy", "7D", "MTD", "30D", "YTD"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`segmented__btn ${period === p ? "segmented__btn--active" : ""}`}>
              {p}
            </button>
          ))}
        </div>
        <button className="btn btn--ghost btn--sm">
          <Icon name="calendar" size={14} />
          1 abr – 18 abr
        </button>
        <button className="btn btn--secondary btn--sm">
          <Icon name="filter" size={14} />
          Filtros
        </button>
        {route.name === "dashboard" || route.name === "list" ? (
          <button className="btn btn--primary btn--sm" onClick={() => setRoute({ name: "builder" })}>
            <Icon name="plus" size={14} />
            Nuevo reporte
          </button>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={onExport}>
            <Icon name="download" size={14} />
            Exportar
          </button>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, PageHeader });
