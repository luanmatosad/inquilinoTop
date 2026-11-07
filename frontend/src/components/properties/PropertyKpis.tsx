import { Card } from '@/components/ui/card'
import { plural } from '@/lib/property-format'

type PropertyKpisProps = {
  totals: { properties: number; units: number; rented: number; vacant: number }
  /** Sem contratos carregados, só Imóveis e Unidades têm valor confiável. */
  occupancyAvailable: boolean
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-[28px] font-semibold leading-9">{value}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </Card>
  )
}

export function PropertyKpis({ totals, occupancyAvailable }: PropertyKpisProps) {
  const summary = [
    plural(totals.properties, 'imóvel', 'imóveis'),
    plural(totals.units, 'unidade', 'unidades'),
    ...(occupancyAvailable ? [`${totals.rented} ${totals.rented === 1 ? 'alugada' : 'alugadas'}`] : []),
  ].join(' · ')

  return (
    <>
      {/* Celular: linha-resumo (canvas M-Imoveis) no lugar dos cartões. */}
      <p className="text-sm text-muted-foreground md:hidden">{summary}</p>
      <section aria-label="Indicadores" className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Imóveis" value={totals.properties} sub="cadastrados" />
        <Kpi label="Unidades" value={totals.units} sub={`em ${plural(totals.properties, 'imóvel', 'imóveis')}`} />
        {occupancyAvailable && (
          <>
            <Kpi label="Alugadas" value={totals.rented} sub={`de ${totals.units}`} />
            <Kpi label="Vagas" value={totals.vacant} sub="sem contrato" />
          </>
        )}
      </section>
    </>
  )
}
