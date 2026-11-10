import { getFinancialConfig } from './actions'
import { FinancialForm } from './FinancialForm'

export default async function FinancialSettingsPage() {
  const config = await getFinancialConfig()

  return (
    <section aria-label="Recebimento (Pix)" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Recebimento (Pix)</h2>
        <p className="text-sm text-muted-foreground">Onde seus inquilinos pagam e as regras padrão de juros e multa.</p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <FinancialForm initialData={config} />
      </div>
    </section>
  )
}
