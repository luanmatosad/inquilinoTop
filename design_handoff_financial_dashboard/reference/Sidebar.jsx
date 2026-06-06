/* Sidebar.jsx — fixed 256px left nav, grouped sections. */

const NAV = {
  Gestão: [
    { id: "dashboard", label: "Dashboard", icon: "Dashboard" },
    { id: "properties", label: "Imóveis", icon: "Building" },
    { id: "tenants", label: "Inquilinos", icon: "Users" },
    { id: "leases", label: "Contratos", icon: "FileText" },
  ],
  Financeiro: [
    { id: "fin-dashboard", label: "Visão geral", icon: "Wallet" },
    { id: "receivables", label: "Contas a receber", icon: "ArrDown" },
    { id: "payables", label: "Contas a pagar", icon: "ArrUp" },
    { id: "reconciliation", label: "Conciliação", icon: "ArrLR" },
    { id: "transfers", label: "Repasses", icon: "Send" },
    { id: "commissions", label: "Comissões", icon: "Percent" },
  ],
  Outros: [
    { id: "support", label: "Suporte", icon: "Headphones" },
    { id: "settings", label: "Configurações", icon: "Settings" },
  ],
};

function SidebarItem({ active, icon, children, onClick }) {
  const [hover, setHover] = React.useState(false);
  const IconC = I[icon] || I.Dashboard;
  return (
    <a
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        margin: "0 10px", padding: "9px 12px", borderRadius: 8,
        font: "500 13px var(--font-sans)",
        color: active || hover ? "var(--on-surface)" : "var(--on-surface-variant)",
        background: active ? "var(--sidebar-accent)" : hover ? "rgba(0,0,0,.04)" : "transparent",
        cursor: "pointer", textDecoration: "none",
        position: "relative",
      }}
    >
      {active && <span style={{
        position: "absolute", left: -10, top: 8, bottom: 8, width: 3,
        background: "var(--primary)", borderRadius: 9999,
      }} />}
      <IconC size={16} />
      <span>{children}</span>
    </a>
  );
}

function Sidebar({ current, onNavigate }) {
  return (
    <aside style={{
      width: 256, flexShrink: 0,
      background: "var(--sidebar)",
      borderRight: "1px solid var(--sidebar-border)",
      display: "flex", flexDirection: "column",
      padding: "18px 0",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: "0 18px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="32" height="32" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#0057be"/>
          <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M9 24V11l7-3 7 3v13"/><path d="M9 24h14"/>
          </g>
          <circle cx="25" cy="8" r="2.2" fill="#fd8b00"/>
        </svg>
        <div>
          <div style={{ font: "700 16px var(--font-sans)", color: "var(--primary)", letterSpacing: "-0.01em" }}>
            InquilinoTop
          </div>
          <div style={{ font: "400 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>
            Gestão imobiliária
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {Object.entries(NAV).map(([section, items]) => (
          <React.Fragment key={section}>
            <div style={{
              padding: "12px 22px 4px",
              font: "600 10px var(--font-sans)",
              color: "var(--on-surface-variant)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>{section}</div>
            {items.map((it) => (
              <SidebarItem
                key={it.id}
                icon={it.icon}
                active={current === it.id}
                onClick={() => onNavigate?.(it.id)}
              >{it.label}</SidebarItem>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div style={{ padding: "12px 14px 0" }}>
        <Button style={{ width: "100%" }} onClick={() => onNavigate?.("properties")}>
          <I.Plus size={14} /> Novo imóvel
        </Button>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
