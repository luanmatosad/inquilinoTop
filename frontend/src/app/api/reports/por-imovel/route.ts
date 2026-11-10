import { goFetch } from '@/lib/go/client'
import { buildUnitRows, csvFilename, parseYear, toCsv, type ByProperty } from '@/lib/report-overview'

// A planilha sai do mesmo cálculo da tela: busca o backend com o token do usuário (cookie httpOnly) e devolve o CSV.
export async function GET(req: Request) {
  const year = parseYear(new URL(req.url).searchParams.get('ano') ?? undefined)
  try {
    const [report, properties] = await Promise.all([
      goFetch<ByProperty>(`/api/v1/reports/by-property?year=${year}`, {}),
      goFetch<{ id: string; name: string; units?: { id: string; label: string }[] | null }[]>('/api/v1/properties', {}).catch(() => []),
    ])
    const csv = toCsv(buildUnitRows(report.rows ?? [], properties ?? []), report.totals)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename(year)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar a planilha:', error)
    return new Response('Não foi possível gerar a planilha.', { status: 502 })
  }
}
