import { getFinancialConfig } from './actions'
import { FinancialForm } from './FinancialForm'

export default async function FinancialSettingsPage() {
  const config = await getFinancialConfig()

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações Financeiras</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie como você recebe pagamentos e as regras padrões de juros e multas.
        </p>
      </div>

      <div className="bg-background border border-border rounded-xl p-6 shadow-sm">
        <FinancialForm initialData={config} />
      </div>
    </div>
  )
}
