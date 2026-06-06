/* Primitives.jsx — Button, FormField, Modal, StatusBadge, Card. */

const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------- Button ---------- */
const buttonStyles = {
  base: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 14,
    borderRadius: 8, border: "1px solid transparent", cursor: "pointer",
    transition: "all .15s", whiteSpace: "nowrap", lineHeight: 1,
  },
  sizes: {
    sm: { height: 30, padding: "0 12px", fontSize: 13, borderRadius: 6 },
    md: { height: 36, padding: "0 14px" },
    lg: { height: 42, padding: "0 18px", fontSize: 15 },
    icon: { height: 36, width: 36, padding: 0 },
  },
  variants: {
    primary:   { background: "var(--primary)", color: "#fff" },
    secondary: { background: "var(--surface-container)", color: "var(--on-surface)" },
    outline:   { background: "var(--card)", color: "var(--on-surface)", borderColor: "var(--border)" },
    ghost:     { background: "transparent", color: "var(--on-surface)" },
    destructive: { background: "var(--destructive)", color: "#fff" },
    link:      { background: "transparent", color: "var(--primary)", padding: 0, height: "auto" },
    whatsapp:  { background: "rgba(37,211,102,.12)", color: "#15803d", borderRadius: 9999 },
  },
};
function Button({ variant = "primary", size = "md", style, onMouseEnter, onMouseLeave, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const merged = {
    ...buttonStyles.base,
    ...buttonStyles.sizes[size],
    ...buttonStyles.variants[variant],
    ...(hover && variant === "primary" ? { background: "#004696" } : {}),
    ...(hover && variant === "outline" ? { background: "var(--surface-container-low)" } : {}),
    ...(hover && variant === "ghost" ? { background: "var(--surface-container)" } : {}),
    ...(hover && variant === "secondary" ? { background: "var(--surface-container-high)" } : {}),
    ...(hover && variant === "destructive" ? { background: "#991111" } : {}),
    ...(hover && variant === "link" ? { textDecoration: "underline" } : {}),
    ...style,
  };
  return (
    <button
      {...rest}
      style={merged}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
    />
  );
}

/* ---------- FormField ---------- */
function FormField({ label, error, hint, children, action }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ font: "500 12px var(--font-sans)", color: "var(--on-surface)" }}>{label}</span>
        {action}
      </div>
      {children}
      {error ? <span style={{ font: "400 11px var(--font-sans)", color: "var(--destructive)" }}>{error}</span>
        : hint ? <span style={{ font: "400 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>{hint}</span>
        : null}
    </label>
  );
}

function Input({ icon, suffix, error, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 36, padding: "0 12px",
        background: "var(--card)",
        border: `1px solid ${error ? "var(--destructive)" : focus ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 8,
        boxShadow: focus && !error ? "0 0 0 3px rgba(0,87,190,.25)" : "none",
        ...style,
      }}
    >
      {icon && <span style={{ display: "flex", color: "var(--on-surface-variant)" }}>{icon}</span>}
      <input
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          font: "400 13px var(--font-sans)", color: "var(--on-surface)", width: "100%",
        }}
      />
      {suffix && <span style={{ display: "flex", color: "var(--on-surface-variant)" }}>{suffix}</span>}
    </div>
  );
}

/* ---------- StatusBadge ---------- */
const badgePalette = {
  PAID:      { bg: "#d1fadf", fg: "#15803d", dot: "#22c55e", label: "Pago" },
  PENDING:   { bg: "#fff0c2", fg: "#b45309", dot: "#f59e0b", label: "Pendente" },
  OVERDUE:   { bg: "#fee2e2", fg: "#7f1010", dot: "#ba1a1a", label: "Atrasado" },
  REVIEW:    { bg: "#dbe7ff", fg: "#00366f", dot: "#2563eb", label: "Em revisão" },
  RECONCILED:{ bg: "#eef2ff", fg: "#3730a3", dot: "#646be3", label: "Conciliado" },
  NEW:       { bg: "#ffe5bf", fg: "#6f3c00", dot: "#fd8b00", label: "Novo" },
  NEUTRAL:   { bg: "var(--surface-container)", fg: "var(--on-surface-variant)", dot: "var(--on-surface-variant)", label: "—" },
};
function StatusBadge({ status, children }) {
  const p = badgePalette[status] || badgePalette.NEUTRAL;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 9999,
      font: "500 12px var(--font-sans)",
      background: p.bg, color: p.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: p.dot }} />
      {children || p.label}
    </span>
  );
}

/* ---------- Card ---------- */
function Card({ style, children, ...rest }) {
  return (
    <div {...rest} style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      boxShadow: "var(--shadow-sm)",
      ...style,
    }}>{children}</div>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, children, footer, maxWidth = 640 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        animation: "fadeIn .15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)", borderRadius: 14, width: "100%", maxWidth,
          boxShadow: "var(--shadow-lg)", overflow: "hidden",
          animation: "popIn .18s ease",
        }}
      >
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ font: "600 18px var(--font-sans)", margin: 0, color: "var(--on-surface)" }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: 6, borderRadius: 6, color: "var(--on-surface-variant)",
            display: "flex", alignItems: "center",
          }}>
            <I.X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "12px 20px", borderTop: "1px solid var(--border)",
            background: "var(--surface)", display: "flex", justifyContent: "flex-end", gap: 10,
          }}>{footer}</div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn  { from { opacity:0; transform: scale(.96) } to { opacity:1; transform: scale(1) } }
      `}</style>
    </div>
  );
}

Object.assign(window, { Button, FormField, Input, StatusBadge, Card, Modal, cx, badgePalette });
