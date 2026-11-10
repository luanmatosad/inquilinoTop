import Link from 'next/link'
import { Download } from 'lucide-react'

import { goFetch } from '@/lib/go/client'
import { formatCurrency } from '@/lib/utils'
import { buildUnitRows, parseYear, periodLabel, yearOptions, type ByProperty } from '@/lib/report-overview'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { YearChips } from '@/components/reports/YearChips'

const BASE = '/reports/por-imovel'

type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

export default async function ByPropertyPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams
  const year = parseYear(ano)

  const [reportRes, propertiesRes] = await Promise.allSettled([
    goFetch<ByProperty>(`/api/v1/reports/by-property?year=${year}`, {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
  ])

  const crumb = (
    <nav aria-label="Navegação" className="text-sm text-muted-foreground">
      <Link href={`/reports?ano=${year}`} className="hover:underline">
        Relatórios
      </Link>{' '}
      › Por imóvel
    </nav>
  )

  if (reportRes.status === 'rejected') {
    console.error('Erro ao buscar o resultado por imóvel:', reportRes.reason)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {crumb}
        <h1 className="text-2xl font-semibold leading-[1.2]">Resultado por imóvel</h1>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-12 text-center">
          <p className="text-muted-foreground">Não foi possível carregar os relatórios.</p>
          <Button asChild variant="outline">
            <Link href={`${BASE}?ano=${year}`}>Tentar novamente</Link>
          </Button>
        </div>
      </div>
    )
  }
  if (propertiesRes.status === 'rejected') console.error('Erro ao buscar imóveis:', propertiesRes.reason)

  const report = reportRes.value
  const rows = buildUnitRows(report.rows ?? [], propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []) : [])
  const t = report.totals

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          {crumb}
          <h1 className="text-2xl font-semibold leading-[1.2]">Resultado por imóvel</h1>
          <p className="text-sm text-muted-foreground">{periodLabel(report.year, report.through_month)}</p>
        </div>
        {rows.length > 0 && (
          <Button asChild variant="outline" className="ml-auto">
            <a href={`/api/reports/por-imovel?ano=${year}`} download>
              <Download aria-hidden="true" />
              Exportar planilha
            </a>
          </Button>
        )}
      </div>
      <YearChips basePath={BASE} active={year} years={yearOptions()} />
      {propertiesRes.status === 'rejected' && (
        <p role="status" className="text-sm text-muted-foreground">
          Imóveis indisponíveis no momento: os nomes aparecem como “—”.
        </p>
      )}

      {rows.length === 0 ? (
        <p role="status" className="rounded-xl bg-muted px-4 py-12 text-center text-sm text-muted-foreground">
          Nenhum recebimento ou despesa pago neste período.
        </p>
      ) : (
        <>
          <Card size="flush" className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2">Imóvel</th>
                  <th className="px-4 py-2">Recebido</th>
                  <th className="px-4 py-2">Despesas</th>
                  <th className="px-4 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.unit_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.label}</td>
                    <td className="px-4 py-3">{formatCurrency(r.received)}</td>
                    <td className="px-4 py-3">{formatCurrency(r.expenses)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(r.result)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">{formatCurrency(t.received)}</td>
                  <td className="px-4 py-3">{formatCurrency(t.expenses)}</td>
                  <td className="px-4 py-3">{formatCurrency(t.result)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.unit_id}>
                <Card className="gap-2 p-4">
                  <div className="font-medium">{r.label}</div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Recebido</span>
                    <span>{formatCurrency(r.received)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Despesas</span>
                    <span>{formatCurrency(r.expenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Resultado</span>
                    <span>{formatCurrency(r.result)}</span>
                  </div>
                </Card>
              </li>
            ))}
            <li className="flex justify-between px-1 text-sm font-medium">
              <span>Total</span>
              <span>{formatCurrency(t.result)}</span>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
