/* Header.jsx — top app bar (64px, sticky). */

function Header({ title = "Painel de controle", user = "Luan Matos" }) {
  return (
    <header style={{
      height: 64, padding: "0 24px",
      background: "rgba(249,249,249,.85)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ font: "600 16px var(--font-sans)", color: "var(--primary)" }}>{title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface-container-low)",
          borderRadius: 9999, padding: "0 14px", height: 36, width: 280,
        }}>
          <I.Search size={16} style={{ color: "var(--on-surface-variant)" }} />
          <input
            placeholder="Buscar inquilino, contrato, imóvel…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              font: "400 13px var(--font-sans)", color: "var(--on-surface)",
            }}
          />
          <kbd style={{
            font: "500 10px var(--font-mono)", color: "var(--on-surface-variant)",
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "1px 5px",
          }}>⌘K</kbd>
        </div>

        <button title="Notificações" style={iconBtn}>
          <I.Bell size={18} />
          <span style={{
            position: "absolute", top: 6, right: 6, width: 8, height: 8,
            borderRadius: 9999, background: "var(--destructive)", border: "2px solid var(--surface)",
          }} />
        </button>
        <button title="Configurações" style={iconBtn}><I.Settings size={18} /></button>

        <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 4px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 4px 4px", borderRadius: 9999, cursor: "pointer", background: "transparent" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9999,
            background: "linear-gradient(135deg,#0057be,#fd8b00)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            font: "600 12px var(--font-sans)",
          }}>{user.split(" ").map(s => s[0]).slice(0,2).join("")}</div>
          <div>
            <div style={{ font: "500 13px var(--font-sans)", color: "var(--on-surface)" }}>{user}</div>
            <div style={{ font: "400 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>Gestor financeiro</div>
          </div>
          <I.ChevronDown size={14} style={{ color: "var(--on-surface-variant)" }} />
        </div>
      </div>
    </header>
  );
}

const iconBtn = {
  position: "relative",
  width: 36, height: 36, border: "none", background: "transparent",
  borderRadius: 9999, cursor: "pointer", color: "var(--on-surface-variant)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

window.Header = Header;
