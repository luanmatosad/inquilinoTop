import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { defaultMonth } from '@/lib/carne-leao'
import { parseYear, periodLabel, yearOptions, type Overview } from '@/lib/report-overview'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MonthlyChart } from '@/components/reports/MonthlyChart'
import { YearChips } from '@/components/reports/YearChips'

const BASE = '/reports'

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-[22px] font-semibold leading-[30px] md:text-[28px] md:leading-9">{value}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </Card>
  )
}

function ReportCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{text}</span>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href={href}>
            Abrir <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams
  const year = parseYear(ano)

  let overview: Overview | undefined
  try {
    overview = await goFetch<Overview>(`/api/v1/reports/overview?year=${year}`, {})
  } catch (error) {
    console.error('Erro ao buscar o relatório:', error)
  }

  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold leading-[1.2]">Relatórios</h1>
      {overview && <p className="text-sm text-muted-foreground">{periodLabel(overview.year, overview.through_month)}</p>}
    </div>
  )

  if (!overview) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">
          <p className="text-muted-foreground">Não foi possível carregar os relatórios.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}?ano=${year}`}>Tentar novamente</Link>
          </Button>
        </div>
      </div>
    )
  }

  const t = overview.totals
  const empty = overview.through_month === 0
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {heading}
      <YearChips basePath={BASE} active={year} years={yearOptions()} />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Kpi label="Recebido no ano" value={formatCurrency(t.received)} sub={`${t.payments_count ?? 0} ${t.payments_count === 1 ? 'pagamento' : 'pagamentos'}`} />
        <Kpi label="Despesas" value={formatCurrency(t.expenses)} sub="pagas no período" />
        <div className="col-span-2 md:col-span-1">
          <Kpi label="Resultado" value={formatCurrency(t.result)} sub="recebido menos despesas" />
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Por data de pagamento, valores líquidos. Pode diferir do Fechamento, que é por vencimento.</p>

      {empty ? (
        <p role="status" className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não há meses completos em {year}. Os relatórios aparecem a partir de fevereiro.
        </p>
      ) : (
        <Card className="hidden p-4 md:block">
          <MonthlyChart months={overview.months} />
        </Card>
      )}

      <section aria-label="Relatórios" className="grid gap-4 md:grid-cols-3">
        <ReportCard title="Carnê-leão e DIRPF" text="Rendimentos e despesas do mês, prontos para o carnê-leão." href={`/reports/carne-leao?mes=${defaultMonth()}`} />
        <ReportCard title="Resultado por imóvel" text="Quanto cada imóvel rendeu depois das despesas." href={`/reports/por-imovel?ano=${year}`} />
        <ReportCard title="Inadimplência" text="Quem atrasa, quanto e há quanto tempo." href="/financial/receivables?situacao=LATE" />
      </section>
    </div>
  )
}
