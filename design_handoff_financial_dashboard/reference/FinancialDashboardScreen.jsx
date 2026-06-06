/* FinancialDashboardScreen.jsx — redesign of /financial/dashboard */

function FinancialDashboardScreen() {
  const months = ["Dez","Jan","Fev","Mar","Abr","Mai"];
  const receita = [82, 95, 88, 110, 96, 128];
  const despesa = [58, 62, 64, 71, 60, 74];
  const max = 140;

  const overdue = [
    { name: "Carlos Mendes", property: "Sala 502 — Ed. Faria Lima", amount: 6200, days: 12 },
    { name: "Beatriz Almeida", property: "Apto 33 — Edifício Bela Vista", amount: 2850, days: 7 },
    { name: "Renato Lopes", property: "Casa 18 — Vila Olímpia", amount: 4100, days: 3 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ font: "700 24px var(--font-sans)", margin: 0, letterSpacing: "-0.01em", color: "var(--on-surface)" }}>
            Visão geral
          </h1>
          <p style={{ font: "400 13px var(--font-sans)", color: "var(--on-surface-variant)", margin: "4px 0 0" }}>
            Módulo financeiro · maio de 2026
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline">
            <I.Calendar size={14}/> Maio 2026
          </Button>
          <Button>
            <I.Plus size={14}/> Nova cobrança
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          title="Receita realizada"
          icon={I.TrendUp}
          value={<span><span style={{ font: "600 14px var(--font-sans)", color: "var(--on-surface-variant)", marginRight: 4 }}>R$</span>128.450<span style={{ color: "var(--on-surface-variant)", fontWeight: 500 }}>,00</span></span>}
          hint="de R$ 142.000,00 previsto"
          progress={90}
        />
        <KpiCard
          title="Inadimplência"
          icon={I.Alert}
          accent="danger"
          value={<span style={{ color: "var(--destructive)" }}>4,2%</span>}
          hint="3 inquilinos · dentro do esperado"
          trend={{ direction: "down", label: "+0,8 pp vs abr" }}
        />
        <KpiCard
          title="VGA — valor geral"
          icon={I.Building}
          value={<span><span style={{ font: "600 14px var(--font-sans)", color: "var(--on-surface-variant)", marginRight: 4 }}>R$</span>1,42<span style={{ color: "var(--on-surface-variant)", fontWeight: 500 }}>M</span></span>}
          hint="42 imóveis ativos"
          trend={{ direction: "up", label: "+3,1% vs abr" }}
        />
        <KpiCard
          title="A repassar"
          icon={I.Send}
          value={<span><span style={{ font: "600 14px var(--font-sans)", color: "var(--on-surface-variant)", marginRight: 4 }}>R$</span>108.230<span style={{ color: "var(--on-surface-variant)", fontWeight: 500 }}>,00</span></span>}
          hint="29 proprietários · processa 03/06"
        />
      </div>

      {/* Chart + Aging */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div>
              <h2 style={{ font: "600 16px var(--font-sans)", margin: 0, color: "var(--on-surface)" }}>Fluxo de caixa</h2>
              <p style={{ font: "400 12px var(--font-sans)", color: "var(--on-surface-variant)", margin: "2px 0 0" }}>Últimos 6 meses</p>
            </div>
            <div style={{ display: "flex", gap: 12, font: "500 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--primary)" }} />Receita
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-secondary-500)" }} />Despesa
              </span>
            </div>
          </div>
          <div style={{ height: 220, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, padding: "0 8px" }}>
            {months.map((m, i) => (
              <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 180, width: "100%", justifyContent: "center" }}>
                  <div title={`Receita: ${fmtBRL(receita[i] * 1000)}`} style={{ width: "40%", height: `${(receita[i]/max)*100}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0" }} />
                  <div title={`Despesa: ${fmtBRL(despesa[i] * 1000)}`} style={{ width: "40%", height: `${(despesa[i]/max)*100}%`, background: "var(--color-secondary-400)", borderRadius: "4px 4px 0 0" }} />
                </div>
                <div style={{ font: "500 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>{m}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ font: "600 16px var(--font-sans)", margin: 0, color: "var(--on-surface)" }}>Aging de contas</h2>
            <p style={{ font: "400 12px var(--font-sans)", color: "var(--on-surface-variant)", margin: "2px 0 0" }}>Inquilinos em atraso</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {overdue.map((o, idx) => (
              <div key={o.name} style={{
                padding: "12px 0",
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ font: "600 13px var(--font-sans)", color: "var(--on-surface)" }}>{o.name}</div>
                    <div style={{ font: "400 11px var(--font-sans)", color: "var(--on-surface-variant)" }}>{o.property}</div>
                  </div>
                  <StatusBadge status="OVERDUE">{o.days} dias</StatusBadge>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ font: "600 14px var(--font-sans)", color: "var(--destructive)", fontVariantNumeric: "tabular-nums" }}>{fmtBRL(o.amount)}</span>
                  <Button variant="whatsapp" size="sm">
                    <I.Whatsapp size={14}/> Cobrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

window.FinancialDashboardScreen = FinancialDashboardScreen;
