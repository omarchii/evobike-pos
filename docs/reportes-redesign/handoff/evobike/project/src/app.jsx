
// ==== src/primitives.jsx ====
// Icons + small primitives + formatters

const fmtMXN = (n, { compact = false } = {}) => {
  if (n == null) return "—";
  if (compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
    return `$${(n/1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
};
const fmtPct = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const fmtDelta = (n) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const fmtNum = (n) => n == null ? "—" : new Intl.NumberFormat("es-MX").format(n);
const fmtDate = (d) => {
  const [y, m, day] = d.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
};

// Minimal inline icon set — stroke-based, matches 1.5–1.75 weight of the system
const Icon = ({ name, size = 16, stroke = 1.75, className = "", style = {} }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    report: <><path d="M8 3h8l4 4v14H4V3h4Z"/><path d="M8 13h8M8 17h5M8 9h5"/></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4.5 4.5"/></>,
    filter: <><path d="M3 5h18M6 12h12M10 19h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    download: <><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.4 6.8-4M8.6 13.6l6.8 4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    chevronRight: <><path d="m9 6 6 6-6 6"/></>,
    chevronLeft: <><path d="m15 6-6 6 6 6"/></>,
    arrowUp: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
    arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
    close: <><path d="m6 6 12 12M6 18 18 6"/></>,
    more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7"/></>,
    moon: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></>,
    alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    check: <><path d="m5 12 5 5L20 7"/></>,
    bike: <><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l3 11.5M12 17.5 7 10h7l-3-4H8"/></>,
    wrench: <><path d="M14.7 6.3a4 4 0 0 1 5 5l-11 11a2.8 2.8 0 1 1-4-4l11-11a4 4 0 0 1 0-1Z"/></>,
    box: <><path d="M3 7 12 3l9 4v10l-9 4-9-4V7Z"/><path d="M3 7l9 4m0 0 9-4m-9 4v10"/></>,
    pnl: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></>,
    cash: <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 10v.01M18 14v.01"/></>,
    invoice: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    export: <><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M5 21h14"/></>,
    commission: <><path d="M12 2v20M7 6h7a3 3 0 1 1 0 6H9a3 3 0 1 0 0 6h8"/></>,
    layaway: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 10h8M8 14h5"/><circle cx="16" cy="15" r="2"/></>,
    retention: <><path d="M12 21a9 9 0 1 1 9-9"/><path d="M21 3v6h-6"/><circle cx="12" cy="12" r="3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    margin: <><path d="M5 20 19 4"/><path d="M5 4h14v14"/></>,
    sales: <><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-6"/></>,
    drag: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
    bookmark: <><path d="M6 3h12v18l-6-4-6 4V3Z"/></>,
    sliders: <><path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18"/><path d="M10.5 10.7a2 2 0 0 0 2.8 2.8M7 7.3C4 9 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.5M19.5 16.3C21 14.8 22 13 22 13s-3.5-7-10-7c-1 0-2 .2-3 .5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    logo: <><path d="M12 3 4 8v8l8 5 8-5V8l-8-5Z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style}>
      {paths[name] || null}
    </svg>
  );
};

// Logo
const Logo = ({ size = 20 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <img src="assets/evobike-logo.webp" alt="Evobike" style={{ height: size, display: "block" }} />
  </div>
);

// Chip
const Chip = ({ kind = "neutral", children, dot = false }) => (
  <span className={`chip chip--${kind}`}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", opacity: 0.8 }} />}
    {children}
  </span>
);

// Delta pill
const Delta = ({ value, inverse = false, compact = false }) => {
  const positive = inverse ? value < 0 : value > 0;
  const color = value === 0 ? "var(--on-surf-var)" : positive ? "var(--sec)" : "var(--ter)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.2rem",
      fontSize: compact ? "0.6875rem" : "0.75rem", fontWeight: 600, color, fontVariantNumeric: "tabular-nums",
    }}>
      <Icon name={value >= 0 ? "arrowUp" : "arrowDown"} size={compact ? 10 : 12} stroke={2.25} />
      {fmtDelta(Math.abs(value))}
    </span>
  );
};

Object.assign(window, { fmtMXN, fmtPct, fmtDelta, fmtNum, fmtDate, Icon, Logo, Chip, Delta });


// ==== src/charts.jsx ====
// SVG chart primitives — line, area, bar, sparkline, donut
// All respect --p, --p-bright, --sec, --ter via theme tokens

const ChartAxis = ({ width, height, padding, xDomain, yDomain, xTicks = 6, yTicks = 4 }) => {
  const [yMin, yMax] = yDomain;
  const [xMin, xMax] = xDomain;
  const yStep = (yMax - yMin) / yTicks;
  return (
    <g>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = yMin + yStep * i;
        const y = height - padding.bottom - (i / yTicks) * (height - padding.top - padding.bottom);
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y}
                  stroke="var(--ghost-border)" strokeDasharray={i === 0 ? "0" : "3 4"} />
            <text x={padding.left - 8} y={y + 4} textAnchor="end"
                  fill="var(--on-surf-var)" fontSize="10" fontFamily="var(--font-body)">
              {v >= 1000 ? `${Math.round(v/1000)}k` : Math.round(v)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const LineArea = ({ data, width = 600, height = 240, color = "var(--p-bright)", fill = true,
                   compareData = null, yFormat = "k", xLabels = null }) => {
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const xs = data.map(d => d.x);
  const ys = [...data, ...(compareData || [])].map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = Math.max(...ys) * 1.1;
  const yMin = 0;

  const toX = x => padding.left + ((x - xMin) / (xMax - xMin || 1)) * (width - padding.left - padding.right);
  const toY = y => height - padding.bottom - ((y - yMin) / (yMax - yMin || 1)) * (height - padding.top - padding.bottom);

  const linePath = data.map((d, i) => `${i ? "L" : "M"}${toX(d.x)},${toY(d.y)}`).join(" ");
  const areaPath = `${linePath} L${toX(data[data.length-1].x)},${toY(0)} L${toX(data[0].x)},${toY(0)} Z`;

  const comparePath = compareData
    ? compareData.map((d, i) => `${i ? "L" : "M"}${toX(d.x)},${toY(d.y)}`).join(" ")
    : null;

  const [hover, setHover] = React.useState(null);
  const svgRef = React.useRef(null);

  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    if (mx < padding.left || mx > width - padding.right) { setHover(null); return; }
    const dataX = xMin + ((mx - padding.left) / (width - padding.left - padding.right)) * (xMax - xMin);
    let nearest = data[0], best = Infinity;
    for (const d of data) {
      const dist = Math.abs(d.x - dataX);
      if (dist < best) { best = dist; nearest = d; }
    }
    const cmp = compareData ? compareData.find(d => d.x === nearest.x) : null;
    setHover({ d: nearest, cmp });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}
           onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2ECC71" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ChartAxis width={width} height={height} padding={padding} xDomain={[xMin, xMax]} yDomain={[yMin, yMax]} />
        {/* x labels */}
        {data.map((d, i) => (i % 3 === 0 || i === data.length - 1) && (
          <text key={i} x={toX(d.x)} y={height - 8} textAnchor="middle"
                fill="var(--on-surf-var)" fontSize="10" fontFamily="var(--font-body)">
            {xLabels ? xLabels[i] : d.x}
          </text>
        ))}
        {compareData && (
          <path d={comparePath} fill="none" stroke="var(--on-surf-var)" strokeWidth="1.5"
                strokeDasharray="4 4" opacity="0.55" />
        )}
        {fill && <path d={areaPath} fill="url(#areaFill)" />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover && (
          <>
            <line x1={toX(hover.d.x)} x2={toX(hover.d.x)} y1={padding.top} y2={height - padding.bottom}
                  stroke="var(--p-bright)" strokeDasharray="3 3" opacity="0.6" />
            <circle cx={toX(hover.d.x)} cy={toY(hover.d.y)} r="5" fill={color} stroke="var(--surf-lowest)" strokeWidth="2" />
            {hover.cmp && (
              <circle cx={toX(hover.cmp.x)} cy={toY(hover.cmp.y)} r="4" fill="var(--on-surf-var)"
                      stroke="var(--surf-lowest)" strokeWidth="2" opacity="0.7" />
            )}
          </>
        )}
      </svg>
      {hover && (
        <div className="tt" style={{
          left: `${(toX(hover.d.x) / width) * 100}%`,
          top: 8, transform: "translateX(-50%)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Día {hover.d.x}</div>
          <div style={{ color: color, fontVariantNumeric: "tabular-nums" }}>
            {fmtMXN(hover.d.y, { compact: true })}
          </div>
          {hover.cmp && (
            <div style={{ color: "var(--on-surf-var)", fontSize: "0.625rem", fontVariantNumeric: "tabular-nums" }}>
              Prev: {fmtMXN(hover.cmp.y, { compact: true })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BarStack = ({ data, width = 600, height = 240, keys = [{key: "leo", color: "#2ECC71", label: "LEO"}, {key: "av135", color: "#52B788", label: "AV135"}] }) => {
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const yMax = Math.max(...data.map(d => keys.reduce((s, k) => s + d[k.key], 0))) * 1.1;
  const bw = (width - padding.left - padding.right) / data.length * 0.7;
  const gap = (width - padding.left - padding.right) / data.length * 0.3;
  const [hover, setHover] = React.useState(null);
  const toY = y => height - padding.bottom - (y / yMax) * (height - padding.top - padding.bottom);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <ChartAxis width={width} height={height} padding={padding} xDomain={[0, data.length]} yDomain={[0, yMax]} />
        {data.map((d, i) => {
          const x = padding.left + (bw + gap) * i + gap / 2;
          let yStack = 0;
          return (
            <g key={i} onMouseEnter={() => setHover({ d, i })} onMouseLeave={() => setHover(null)}>
              {keys.map(k => {
                const h = (d[k.key] / yMax) * (height - padding.top - padding.bottom);
                const y = toY(yStack + d[k.key]);
                yStack += d[k.key];
                return <rect key={k.key} x={x} y={y} width={bw} height={h} fill={k.color}
                             rx="2" opacity={hover && hover.i !== i ? 0.4 : 1}
                             style={{ transition: "opacity 120ms" }} />;
              })}
              {(i % 3 === 0 || i === data.length - 1) && (
                <text x={x + bw / 2} y={height - 8} textAnchor="middle"
                      fill="var(--on-surf-var)" fontSize="10" fontFamily="var(--font-body)">
                  {d.day || d.x}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tt" style={{
          left: `${((padding.left + (bw + gap) * hover.i + gap / 2 + bw / 2) / width) * 100}%`,
          top: 8, transform: "translateX(-50%)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Día {hover.d.day || hover.d.x}</div>
          {keys.map(k => (
            <div key={k.key} style={{ display: "flex", gap: 8, justifyContent: "space-between", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: k.color }}>● {k.label}</span>
              <span>{fmtMXN(hover.d[k.key], { compact: true })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Sparkline = ({ data, color = "var(--p-bright)", width = 120, height = 36, fill = true }) => {
  const xs = data.map(d => d.x), ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const toX = x => ((x - xMin) / (xMax - xMin || 1)) * width;
  const toY = y => height - 2 - ((y - yMin) / (yMax - yMin || 1)) * (height - 4);
  const linePath = data.map((d, i) => `${i ? "L" : "M"}${toX(d.x)},${toY(d.y)}`).join(" ");
  const areaPath = `${linePath} L${toX(xMax)},${height} L${toX(xMin)},${height} Z`;
  const gradId = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: height, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color.startsWith("var") ? "#2ECC71" : color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color.startsWith("var") ? "#2ECC71" : color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const SparkBars = ({ data, color = "var(--p-bright)", width = 120, height = 36 }) => {
  const yMax = Math.max(...data.map(d => d.y));
  const bw = width / data.length * 0.7;
  const gap = width / data.length * 0.3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.y / yMax) * (height - 2);
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} fill={color} rx="1" opacity={0.85} />;
      })}
    </svg>
  );
};

const Donut = ({ value, total, size = 88, thickness = 10, color = "var(--p-bright)" }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = value / total;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surf-high)" strokeWidth={thickness} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={thickness}
              strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
};

const ProgressSplit = ({ splits, total }) => {
  const colors = { ter: "var(--ter)", warn: "var(--warn)", sec: "var(--sec)", p: "var(--p-bright)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
      <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--surf-high)" }}>
        {splits.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: colors[s.color] }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        {splits.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: colors[s.color] }} />
              <span style={{ fontSize: "0.625rem", color: "var(--on-surf-var)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtMXN(s.value, { compact: true })}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { LineArea, BarStack, Sparkline, SparkBars, Donut, ProgressSplit });


// ==== src/shell.jsx ====
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


// ==== src/dashboard.jsx ====
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
    // Modular — bigger spacing, one hero plus 2x2 grid
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "1rem", padding: "0 1.5rem" }}>
        {hero && <KPICardEditorial kpi={hero} hero chart={chartDefault} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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


// ==== src/views.jsx ====
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


// ==== src/overlays.jsx ====
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

