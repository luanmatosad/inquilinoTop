import Link from 'next/link'
import { Plus } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date-format'
import {
  buildPayableRows,
  filterPayables,
  monthRange,
  parseMonth,
  payableChipCounts,
  payableIndicators,
  type OverviewExpense,
} from '@/lib/financial-overview'
import { Button } from '@/components/ui/button'
import { ExpenseFormSheet } from '@/components/financial/ExpenseFormSheet'
import { FinancialKpis } from '@/components/financial/FinancialKpis'
import { MonthNav } from '@/components/financial/MonthNav'
import { PayablesList, type PayableItem } from '@/components/financial/PayablesList'
import { SituationChips } from '@/components/financial/SituationChips'
import { plural } from '@/lib/property-format'

const BASE = '/financial/payables'

type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">{children}</div>
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; situacao?: string; novo?: string; unidade?: string }>
}) {
  const { mes, situacao, novo, unidade } = await searchParams
  const ym = parseMonth(mes)
  const { from, to } = monthRange(ym)

  // Despesas (do mês e atrasadas) são obrigatórias; os imóveis só dão nome à unidade.
  const [monthRes, lateRes, propertiesRes] = await Promise.allSettled([
    goFetch<OverviewExpense[]>(`/api/v1/expenses?from=${from}&to=${to}`, {}),
    goFetch<OverviewExpense[]>('/api/v1/expenses?status=LATE', {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
  ])
  const propertiesOk = propertiesRes.status === 'fulfilled'
  if (!propertiesOk) console.error('Erro ao buscar imóveis:', propertiesRes.reason)
  const properties = propertiesOk ? (propertiesRes.value ?? []) : []
  const units = properties.flatMap((p) => (p.units ?? []).map((u) => ({ id: u.id, label: u.label, propertyName: p.name })))

  const newHref = `${BASE}?${new URLSearchParams({ mes: ym, ...(situacao ? { situacao } : {}), novo: '1' }).toString()}`
  const heading = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-[1.2]">Despesas</h1>
        <p className="text-sm text-muted-foreground">O que você paga pelos seus imóveis.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MonthNav basePath={BASE} ym={ym} situacao={situacao} />
        <Button asChild className="max-md:hidden">
          <Link href={newHref}>
            <Plus aria-hidden="true" />
            Lançar despesa
          </Link>
        </Button>
      </div>
    </div>
  )
  const sheet = <ExpenseFormSheet open={novo === '1'} units={units} defaultUnitId={unidade} />

  if (monthRes.status === 'rejected' || lateRes.status === 'rejected') {
    console.error('Erro ao buscar despesas:', monthRes.status === 'rejected' ? monthRes.reason : (lateRes as PromiseRejectedResult).reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {heading}
        <Message>
          <p className="text-muted-foreground">Não foi possível carregar as despesas.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}?mes=${ym}`}>Tentar novamente</Link>
          </Button>
        </Message>
        {sheet}
      </div>
    )
  }

  const all = buildPayableRows({ expenses: [...(monthRes.value ?? []), ...(lateRes.value ?? [])], properties })
  const k = payableIndicators(all)
  const counts = payableChipCounts(all)
  const shown = filterPayables(all, situacao)

  const items: PayableItem[] = shown.map((r) => ({
    id: r.expense.id,
    description: r.expense.description,
    where: r.where,
    category: r.categoryLabel,
    due: formatDateBR(r.expense.due_date).slice(0, 5),
    amount: formatCurrency(r.expense.amount),
    situation: r.situation,
  }))

  const kpis = [
    { label: 'Total do mês', value: formatCurrency(k.total.total), sub: plural(k.total.count, 'despesa', 'despesas') },
    { label: 'Pagas', value: formatCurrency(k.paid.total), sub: plural(k.paid.count, 'despesa', 'despesas') },
    { label: 'A pagar', value: formatCurrency(k.toPay.total), sub: plural(k.toPay.count, 'despesa', 'despesas') },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 max-md:pb-20">
      {heading}
      <FinancialKpis kpis={kpis} mobile={[kpis[1], kpis[2]]} />
      {!propertiesOk && (
        <p role="status" className="text-sm text-muted-foreground">
          Imóveis indisponíveis no momento: a unidade aparece como “—” e não dá para escolher uma ao lançar.
        </p>
      )}

      {all.length === 0 ? (
        <Message>
          <div className="text-base font-semibold">Lance sua primeira despesa</div>
          <p className="max-w-md text-sm text-muted-foreground">Condomínio, IPTU, manutenção: tudo fica ligado a uma unidade.</p>
          <Button asChild variant="outline" className="mt-2">
            <Link href={newHref}>Lançar despesa</Link>
          </Button>
        </Message>
      ) : (
        <>
          <SituationChips
            basePath={BASE}
            ym={ym}
            active={situacao}
            chips={[
              { value: '', label: 'Todas', count: counts.ALL },
              { value: 'PENDING', label: 'A pagar', count: counts.PENDING },
              { value: 'PAID', label: 'Pagas', count: counts.PAID },
            ]}
          />
          {items.length === 0 && (
            <Message>
              <p className="text-muted-foreground">Nenhuma despesa encontrada.</p>
            </Message>
          )}
          <PayablesList rows={items} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-[69px] z-20 border-t bg-background p-3 md:hidden">
        <Button asChild className="w-full">
          <Link href={newHref}>
            <Plus aria-hidden="true" />
            Lançar despesa
          </Link>
        </Button>
      </div>
      {sheet}
    </div>
  )
}
