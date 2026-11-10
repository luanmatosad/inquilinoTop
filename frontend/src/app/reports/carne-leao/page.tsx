import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date-format'
import { formatMonthLabel, shiftMonth } from '@/lib/financial-overview'
import { canGoNext, categoryLabel, labelUnits, parseCarneMonth, statusBanner, type CarneLeao } from '@/lib/carne-leao'
import { plural } from '@/lib/property-format'
import type { MonthClosing } from '@/lib/month-closing'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PrintButton } from '@/components/financial/PrintButton'

const BASE = '/reports/carne-leao'
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-[22px] font-semibold leading-[30px] md:text-[28px] md:leading-9">{value}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </Card>
  )
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </section>
  )
}

export default async function CarneLeaoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams
  const ym = parseCarneMonth(mes)
  const Label = formatMonthLabel(ym)
  const monthName = Label.split(' ')[0]

  const [carneRes, propertiesRes, closingRes] = await Promise.allSettled([
    goFetch<CarneLeao>(`/api/v1/reports/carne-leao?month=${ym}`, {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
    goFetch<MonthClosing>(`/api/v1/closings?month=${ym}`, {}),
  ])

  const crumb = (
    <nav aria-label="Navegação" className="text-sm text-muted-foreground print:hidden">
      <Link href="/reports" className="hover:underline">
        Relatórios
      </Link>{' '}
      › Carnê-leão e DIRPF
    </nav>
  )

  if (carneRes.status === 'rejected') {
    console.error('Erro ao buscar o carnê-leão:', carneRes.reason)
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {crumb}
        <h1 className="text-2xl font-semibold leading-[1.2]">Carnê-leão e DIRPF</h1>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">
          <p className="text-muted-foreground">Não foi possível carregar o relatório.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}?mes=${ym}`}>Tentar novamente</Link>
          </Button>
        </div>
      </div>
    )
  }
  if (propertiesRes.status === 'rejected') console.error('Erro ao buscar imóveis:', propertiesRes.reason)
  if (closingRes.status === 'rejected') console.error('Erro ao buscar o fechamento:', closingRes.reason)

  const c = carneRes.value
  const properties = propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []) : []
  const income = labelUnits(c.income.lines ?? [], properties)
  const deductions = labelUnits(c.deductions.lines ?? [], properties)
  const banner = statusBanner(closingRes.status === 'fulfilled' ? closingRes.value?.status : undefined, monthName, c.due_date)

  const monthNav = (
    <div className="flex items-center gap-1 print:hidden">
      <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
        <Link href={`${BASE}?mes=${shiftMonth(ym, -1)}`} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {Label}
      </span>
      {canGoNext(ym) ? (
        <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
          <Link href={`${BASE}?mes=${shiftMonth(ym, 1)}`} aria-label="Próximo mês">
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon" aria-label="Próximo mês" disabled>
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1">
          {crumb}
          <h1 className="text-2xl font-semibold leading-[1.2]">Carnê-leão e DIRPF</h1>
          <p className="text-sm text-muted-foreground">{Label}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
          {monthNav}
          <PrintButton label="Baixar para o contador" primary />
          <Button asChild variant="outline">
            <a href={`/api/reports/carne-leao?mes=${ym}`} download>
              <Download aria-hidden="true" />
              Exportar planilha
            </a>
          </Button>
        </div>
      </div>

      <div role="status" className={`flex flex-col gap-1 rounded-xl border p-4 text-sm ${banner.kind === 'closed' ? 'border-accent bg-accent text-accent-foreground' : 'bg-muted'}`}>
        {banner.title && <span className="font-medium">{banner.title}</span>}
        <span className={banner.kind === 'closed' ? '' : 'text-muted-foreground'}>{banner.text}</span>
        {banner.kind === 'open' && (
          <Link href={`/financial/receivables/fechamento?mes=${ym}`} className="self-start font-medium underline print:hidden">
            Ir para o Fechamento
          </Link>
        )}
      </div>

      <section aria-label="Totais" className="grid gap-3 md:grid-cols-3 md:gap-4">
        <Kpi label="Rendimentos de aluguel" value={formatCurrency(c.income.total)} sub={`${plural(c.income.count, 'pagamento recebido', 'pagamentos recebidos')}`} />
        <Kpi label="Despesas que entram" value={formatCurrency(c.deductions.total)} sub={plural(c.deductions.count, 'despesa', 'despesas')} />
        <Kpi label="Base de cálculo (estimada)" value={formatCurrency(c.base)} sub="rendimentos menos despesas" />
      </section>

      {propertiesRes.status === 'rejected' && (
        <p role="status" className="text-sm text-muted-foreground">
          Imóveis indisponíveis no momento: os nomes aparecem como “—”.
        </p>
      )}

      <Section title="Quem pagou" text="Inquilinos pessoa física e valores recebidos no mês.">
        {income.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Nenhum aluguel de pessoa física recebido neste mês.</p>
        ) : (
          <>
            <Card size="flush" className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2">Pagador</th>
                    <th className="px-4 py-2">Imóvel</th>
                    <th className="px-4 py-2">Recebido em</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {income.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-3 font-medium">{l.payer}</td>
                      <td className="px-4 py-3">{l.label}</td>
                      <td className="px-4 py-3">{dayMonth(l.paid_date)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card size="flush" className="md:hidden">
              <ul className="divide-y">
                {income.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{l.payer}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.label} · {dayMonth(l.paid_date)}
                      </div>
                    </div>
                    <span className="font-semibold">{formatCurrency(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Section>

      <Section title="Despesas que entram" text="Só as categorias Impostos e Condomínio. Confirme com seu contador o que pode ser deduzido.">
        {deductions.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma despesa dessas categorias paga neste mês.</p>
        ) : (
          <>
            <Card size="flush" className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2">Despesa</th>
                    <th className="px-4 py-2">Imóvel</th>
                    <th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-3 font-medium">{l.description}</td>
                      <td className="px-4 py-3">{l.label}</td>
                      <td className="px-4 py-3">{categoryLabel(l.category)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card size="flush" className="md:hidden">
              <ul className="divide-y">
                {deductions.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{l.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.label} · {categoryLabel(l.category)}
                      </div>
                    </div>
                    <span className="font-semibold">{formatCurrency(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Section>
      <p className="hidden text-xs text-muted-foreground print:block">Prazo estimado: {formatDateBR(c.due_date)}. Gerado pelo ImoviFlow.</p>
    </div>
  )
}
