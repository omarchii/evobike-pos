// Export drawer, thresholds modal, tweaks panel

const ExportDrawer = ({ open, onClose }) => {
  const [format, setFormat] = React.useState("xlsx");
  const [scope, setScope] = React.useState("filtered");
  const [includeCharts, setIncludeCharts] = React.useState(true);
  const [email, setEmail] = React.useState(false);
  if (!open) return null;

  const formats = [
    { id: "csv", label: "CSV", desc: "Texto plano separado por comas", icon: "export" },
    { id: "xlsx", label: "Excel", desc: "Hoja de cálculo con formato y formulas", icon: "invoice" },
    { id: "pdf", label: "PDF", desc: "Documento con branding para compartir", icon: "report" },
    { id: "xml", label: "CFDI XML", desc: "Para envío al contador externo", icon: "export" },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        width: 460, height: "100%",
        background: "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        padding: "1.5rem", overflow: "auto",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="label-md">Exportar</span>
            <h2 className="headline" style={{ margin: 0, fontSize: "1.5rem" }}>Descargar datos</h2>
          </div>
          <button className="btn btn--icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div>
          <div className="label-md" style={{ marginBottom: "0.5rem" }}>Formato</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {formats.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)}
                style={{
                  display: "flex", flexDirection: "column", gap: "0.25rem",
                  padding: "0.75rem 0.85rem", borderRadius: "var(--r-md)",
                  textAlign: "left",
                  background: format === f.id ? "var(--surf-high)" : "var(--surf-lowest)",
                  outline: format === f.id ? "2px solid var(--p-bright)" : "1px solid var(--ghost-border)",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Icon name={f.icon} size={16} style={{ color: format === f.id ? "var(--p)" : "var(--on-surf-var)" }} />
                  {format === f.id && <Icon name="check" size={14} style={{ color: "var(--p-bright)" }} />}
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginTop: "0.35rem" }}>{f.label}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)", lineHeight: 1.4 }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label-md" style={{ marginBottom: "0.5rem" }}>Alcance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {[
              { id: "filtered", label: "Registros filtrados", sub: "Aplica filtros actuales" },
              { id: "all", label: "Todo el período", sub: "1–18 abril 2026" },
              { id: "summary", label: "Solo resumen", sub: "KPIs y gráficos agregados" },
            ].map(s => (
              <label key={s.id} style={{
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.6rem 0.85rem", borderRadius: "var(--r-md)",
                background: scope === s.id ? "var(--surf-high)" : "var(--surf-lowest)",
                outline: "1px solid var(--ghost-border)", cursor: "pointer",
              }}>
                <input type="radio" checked={scope === s.id} onChange={() => setScope(s.id)} style={{ accentColor: "var(--p-bright)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{s.sub}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <ToggleRow label="Incluir gráficos" sub="Solo para PDF" value={includeCharts} onChange={setIncludeCharts} disabled={format !== "pdf"} />
          <ToggleRow label="Enviar por email" sub="Programar envío automático" value={email} onChange={setEmail} />
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}>
          <button className="btn btn--ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" style={{ flex: 2, justifyContent: "center" }}>
            <Icon name="download" size={14} />
            Descargar {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

const ToggleRow = ({ label, sub, value, onChange, disabled }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "0.65rem",
    padding: "0.6rem 0.85rem", borderRadius: "var(--r-md)",
    background: "var(--surf-lowest)", outline: "1px solid var(--ghost-border)",
    opacity: disabled ? 0.5 : 1,
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{sub}</div>}
    </div>
    <button onClick={() => !disabled && onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 999,
      background: value ? "var(--p-bright)" : "var(--surf-high)",
      position: "relative", transition: "background 120ms",
    }}>
      <span style={{
        position: "absolute", top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 120ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  </div>
);

const ThresholdsModal = ({ open, onClose }) => {
  const [thresholds, setThresholds] = React.useState({
    stockMin: 5,
    marginMin: 30,
    cxpDays: 3,
    slaHours: 48,
  });
  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "grid", placeItems: "center" }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        width: 520, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto",
        background: "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        padding: "1.75rem", borderRadius: "var(--r-lg)",
        boxShadow: "0px 24px 64px -8px rgba(19,27,46,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <span className="label-md">Configuración</span>
            <h2 className="headline" style={{ margin: 0, fontSize: "1.25rem" }}>Umbrales de alerta</h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>
              Define cuándo el sistema debe notificarte en el panel de alertas.
            </p>
          </div>
          <button className="btn btn--icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <ThresholdRow label="Stock mínimo" sub="Items que disparan alerta crítica" value={thresholds.stockMin} suffix="uds" onChange={v => setThresholds({ ...thresholds, stockMin: v })} max={20} />
          <ThresholdRow label="Margen mínimo" sub="% por debajo del cual se alerta" value={thresholds.marginMin} suffix="%" onChange={v => setThresholds({ ...thresholds, marginMin: v })} max={60} />
          <ThresholdRow label="Vencimiento CxP" sub="Días de anticipación para notificar" value={thresholds.cxpDays} suffix="d" onChange={v => setThresholds({ ...thresholds, cxpDays: v })} max={30} />
          <ThresholdRow label="SLA taller" sub="Horas máximas para OT abierta" value={thresholds.slaHours} suffix="h" onChange={v => setThresholds({ ...thresholds, slaHours: v })} max={120} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
          <button className="btn btn--ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>
            <Icon name="check" size={14} /> Guardar umbrales
          </button>
        </div>
      </div>
    </div>
  );
};

const ThresholdRow = ({ label, sub, value, onChange, max, suffix }) => (
  <div style={{ padding: "0.85rem 1rem", borderRadius: "var(--r-md)", background: "var(--surf-lowest)", outline: "1px solid var(--ghost-border)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
      <div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>{sub}</div>
      </div>
      <span className="display" style={{ fontSize: "1.1rem", fontVariantNumeric: "tabular-nums" }}>{value}{suffix}</span>
    </div>
    <input type="range" min="1" max={max} value={value} onChange={e => onChange(parseInt(e.target.value))}
           style={{ width: "100%", accentColor: "var(--p-bright)" }} />
  </div>
);

const TweaksPanel = ({ open, onClose, state, setState }) => {
  if (!open) return null;
  const kpiLabels = {
    ventasNetas: "Ventas netas", margenBruto: "Margen bruto",
    cxc: "Cuentas por cobrar", cxp: "Cuentas por pagar", stockCritico: "Stock crítico",
  };
  const sectionLabels = {
    hero: "Hero KPIs", trend: "Tendencia de ingresos", branches: "Comparativo sucursales",
    products: "Top productos", alerts: "Alertas activas", lowstock: "Stock crítico (tabla)", reports: "Reportes fijados",
  };

  const moveKpi = (idx, dir) => {
    const order = [...state.kpiOrder];
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    setState({ ...state, kpiOrder: order });
  };

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, width: 340, zIndex: 70 }} className="fade-in">
      <div style={{
        background: "color-mix(in srgb, var(--surf-bright) 94%, transparent)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderRadius: "var(--r-lg)", boxShadow: "0px 24px 64px -8px rgba(19,27,46,0.18)",
        outline: "1px solid var(--ghost-border)",
        maxHeight: "80vh", overflow: "auto",
      }}>
        <div style={{ padding: "1rem 1.15rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "inherit", backdropFilter: "blur(20px)", zIndex: 1 }}>
          <div>
            <span className="label-md" style={{ fontSize: "0.5625rem" }}>Tweaks</span>
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Ajustes de vista</h3>
          </div>
          <button className="btn btn--icon" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div style={{ padding: "0 1.15rem 1.15rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <TweakGroup title="Variante del dashboard">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.35rem" }}>
              {[
                { id: "editorial", label: "Editorial", sub: "Linear" },
                { id: "stripe", label: "Stripe", sub: "Financial" },
                { id: "mercury", label: "Mercury", sub: "Modular" },
              ].map(v => (
                <button key={v.id} onClick={() => setState({ ...state, variant: v.id })} style={{
                  padding: "0.55rem 0.4rem", borderRadius: "var(--r-md)",
                  background: state.variant === v.id ? "var(--surf-high)" : "var(--surf-lowest)",
                  outline: state.variant === v.id ? "2px solid var(--p-bright)" : "1px solid var(--ghost-border)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{v.label}</div>
                  <div style={{ fontSize: "0.625rem", color: "var(--on-surf-var)" }}>{v.sub}</div>
                </button>
              ))}
            </div>
          </TweakGroup>

          <TweakGroup title="Modo">
            <div className="segmented" style={{ width: "100%" }}>
              <button onClick={() => setState({ ...state, dark: false })}
                className={`segmented__btn ${!state.dark ? "segmented__btn--active" : ""}`}
                style={{ flex: 1 }}>
                <Icon name="sun" size={12} /> Light
              </button>
              <button onClick={() => setState({ ...state, dark: true })}
                className={`segmented__btn ${state.dark ? "segmented__btn--active" : ""}`}
                style={{ flex: 1 }}>
                <Icon name="moon" size={12} /> Dark
              </button>
            </div>
          </TweakGroup>

          <TweakGroup title="Densidad">
            <div className="segmented" style={{ width: "100%" }}>
              {["compact", "comfortable"].map(d => (
                <button key={d} onClick={() => setState({ ...state, density: d })}
                  className={`segmented__btn ${state.density === d ? "segmented__btn--active" : ""}`}
                  style={{ flex: 1, textTransform: "capitalize" }}>
                  {d === "compact" ? "Compacto" : "Cómodo"}
                </button>
              ))}
            </div>
          </TweakGroup>

          <TweakGroup title="Gráfico por defecto">
            <div className="segmented" style={{ width: "100%" }}>
              {[{id:"line",l:"Línea"},{id:"bars",l:"Barras"},{id:"area",l:"Área"}].map(o => (
                <button key={o.id} onClick={() => setState({ ...state, chartDefault: o.id })}
                  className={`segmented__btn ${state.chartDefault === o.id ? "segmented__btn--active" : ""}`}
                  style={{ flex: 1 }}>
                  {o.l}
                </button>
              ))}
            </div>
          </TweakGroup>

          <TweakGroup title="Orden de KPIs">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {state.kpiOrder.map((id, i) => (
                <div key={id} style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.45rem 0.6rem", borderRadius: "var(--r-sm)",
                  background: "var(--surf-lowest)", outline: "1px solid var(--ghost-border)",
                }}>
                  <Icon name="drag" size={12} style={{ color: "var(--on-surf-var)" }} />
                  <span style={{ flex: 1, fontSize: "0.75rem" }}>{kpiLabels[id]}</span>
                  <button className="btn btn--icon" style={{ padding: 2 }} onClick={() => moveKpi(i, -1)} disabled={i === 0}>
                    <Icon name="arrowUp" size={12} />
                  </button>
                  <button className="btn btn--icon" style={{ padding: 2 }} onClick={() => moveKpi(i, 1)} disabled={i === state.kpiOrder.length - 1}>
                    <Icon name="arrowDown" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </TweakGroup>

          <TweakGroup title="Secciones visibles">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(sectionLabels).map(([id, label]) => {
                const visible = state.sections[id] !== false;
                return (
                  <button key={id} onClick={() => setState({ ...state, sections: { ...state.sections, [id]: !visible } })}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.45rem 0.6rem", borderRadius: "var(--r-sm)",
                      background: visible ? "var(--surf-lowest)" : "transparent",
                      outline: "1px solid var(--ghost-border)",
                      opacity: visible ? 1 : 0.6,
                    }}>
                    <Icon name={visible ? "eye" : "eyeOff"} size={12} style={{ color: visible ? "var(--p)" : "var(--on-surf-var)" }} />
                    <span style={{ flex: 1, fontSize: "0.75rem", textAlign: "left" }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </TweakGroup>
        </div>
      </div>
    </div>
  );
};

const TweakGroup = ({ title, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
    <div className="label-md" style={{ fontSize: "0.5625rem" }}>{title}</div>
    {children}
  </div>
);

Object.assign(window, { ExportDrawer, ThresholdsModal, TweaksPanel });
