import Link from 'next/link'

import { goFetch } from '@/lib/go/client'
import type { FinancialRules } from '@/lib/financial-rules'
import { Button } from '@/components/ui/button'
import { RulesForm } from './RulesForm'

export default async function FinancialRulesPage() {
  let rules: FinancialRules | undefined
  try {
    rules = await goFetch<FinancialRules>('/api/v1/settings/financial-rules', {})
  } catch (error) {
    console.error('Erro ao buscar as regras financeiras:', error)
  }

  return (
    <section aria-label="Regras financeiras" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Regras financeiras</h2>
        <p className="text-sm text-muted-foreground">Valem para novos contratos. Dá para mudar em cada contrato.</p>
      </div>
      {rules ? (
        <RulesForm rules={rules} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as regras financeiras.</p>
          <Button asChild variant="outline">
            <Link href="/settings/rules">Tentar novamente</Link>
          </Button>
        </div>
      )}
    </section>
  )
}
