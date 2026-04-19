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
