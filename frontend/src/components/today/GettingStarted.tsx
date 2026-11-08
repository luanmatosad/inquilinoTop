import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { buildChecklist } from '@/lib/today-overview'

type Checklist = ReturnType<typeof buildChecklist>

/** Primeiros passos da conta nova (nenhum contrato ainda) e atalho para importar planilha. */
export function GettingStarted({ checklist }: { checklist: Checklist }) {
  const pct = Math.round((checklist.done / checklist.total) * 100)
  return (
    <>
      <section aria-label="Primeiros passos">
        <Card className="gap-4 p-4">
          <div>
            <h2 className="text-base font-semibold">Primeiros passos</h2>
            <p className="text-sm text-muted-foreground">Leva uns 5 minutos.</p>
          </div>
          <div className="flex items-center gap-3">
            <div role="progressbar" aria-label="Primeiros passos concluídos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 flex-1 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {checklist.done} de {checklist.total}
            </span>
          </div>
          <ul className="flex flex-col">
            {checklist.steps.map((s) => (
              <li key={s.key} className={`flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0 ${s.blocked ? 'opacity-60' : ''}`}>
                <span className={s.done ? 'text-success' : 'text-muted-foreground'}>
                  {s.done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.hint}</div>
                </div>
                {!s.done && !s.blocked && s.href && (
                  <Button asChild variant="outline" size="sm" className="max-md:w-full">
                    <Link href={s.href}>{s.cta}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card className="gap-2 bg-muted p-4 shadow-none">
        <div className="text-sm font-medium">Já tem tudo numa planilha?</div>
        <p className="text-sm text-muted-foreground">Importe imóveis, inquilinos e contratos de uma vez.</p>
        <Button asChild variant="outline" className="w-fit max-md:w-full">
          <Link href="/import">Importar planilha</Link>
        </Button>
      </Card>
    </>
  )
}
