import { Card } from '@/components/ui/card'

export type Kpi = { label: string; value: string; sub: string }

/** Desktop: cartões. Celular: um cartão-resumo com os dois primeiros valores relevantes. */
export function FinancialKpis({ kpis, mobile }: { kpis: Kpi[]; mobile: [Kpi, Kpi] }) {
  return (
    <>
      <section aria-label="Indicadores" className="hidden gap-4 md:grid md:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="gap-1 p-4">
            <div className="text-sm font-medium text-muted-foreground">{k.label}</div>
            <div className="text-[28px] font-semibold leading-9">{k.value}</div>
            <div className="text-sm text-muted-foreground">{k.sub}</div>
          </Card>
        ))}
      </section>
      <Card className="flex-row justify-between gap-4 p-4 md:hidden">
        {mobile.map((k, i) => (
          <div key={k.label} className={i ? 'text-right' : ''}>
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-base font-semibold">{k.value}</div>
          </div>
        ))}
      </Card>
    </>
  )
}
