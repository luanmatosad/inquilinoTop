/* KpiCard.jsx — dashboard KPI tile. */

function fmtBRL(val, opts = {}) {
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", ...opts });
  return fmt.format(val);
}

function KpiCard({ title, value, hint, icon: IconC, accent = "primary", trend, progress }) {
  const tint = {
    primary: "var(--primary)",
    success: "var(--color-success-600)",
    danger: "var(--destructive)",
    warning: "var(--color-warning-600)",
    accent:  "var(--color-secondary-500)",
  }[accent] || "var(--primary)";

  return (
    <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ font: "500 12px var(--font-sans)", color: "var(--on-surface)" }}>{title}</div>
        {IconC && <IconC size={16} style={{ color: tint }} />}
      </div>
      <div style={{
        font: "700 26px/1 var(--font-sans)",
        color: "var(--on-surface)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}>{value}</div>
      {hint && <div style={{ font: "400 12px var(--font-sans)", color: "var(--on-surface-variant)" }}>{hint}</div>}
      {progress != null && (
        <div style={{ height: 6, background: "var(--surface-variant)", borderRadius: 9999, overflow: "hidden", marginTop: 4 }}>
          <div style={{ height: "100%", background: tint, width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {trend && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          font: "500 11px var(--font-sans)",
          color: trend.direction === "up" ? "var(--color-success-600)" : "var(--destructive)",
          marginTop: 4,
        }}>
          {trend.direction === "up" ? <I.ArrUp size={12}/> : <I.ArrDown size={12}/>}
          {trend.label}
        </div>
      )}
    </Card>
  );
}

window.KpiCard = KpiCard;
window.fmtBRL = fmtBRL;
