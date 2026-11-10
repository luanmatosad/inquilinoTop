import { goFetch } from '@/lib/go/client'
import { carneCsvFilename, parseCarneMonth, toCarneCsv, type CarneLeao } from '@/lib/carne-leao'

// A planilha sai do mesmo cálculo da tela: busca o backend com o token do usuário (cookie httpOnly) e devolve o CSV.
export async function GET(req: Request) {
  const month = parseCarneMonth(new URL(req.url).searchParams.get('mes') ?? undefined)
  try {
    const [carne, properties] = await Promise.all([
      goFetch<CarneLeao>(`/api/v1/reports/carne-leao?month=${month}`, {}),
      goFetch<{ id: string; name: string; units?: { id: string; label: string }[] | null }[]>('/api/v1/properties', {}).catch(() => []),
    ])
    return new Response(toCarneCsv(carne, properties ?? []), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${carneCsvFilename(month)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar a planilha do carnê-leão:', error)
    return new Response('Não foi possível gerar a planilha.', { status: 502 })
  }
}
