import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date-format'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { goFetch } from '@/lib/go/client'
import { Unit, Property, Expense } from '@/types'

interface ActiveLease {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string | null
  rent_amount: number
  status: string
}

export default async function UnitPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let unit: Unit | null = null
  let property: Property | null = null
  let activeLease: ActiveLease | null = null
  let tenantName = '—'
  const expenses: Expense[] = []

  try {
    unit = await goFetch<Unit>("/api/v1/units/" + id, {})
    if (unit?.property_id) {
      property = await goFetch<Property>("/api/v1/properties/" + unit.property_id, {})
    }
  } catch {
    notFound()
  }

  if (!unit) {
    notFound()
  }

  // Contrato ativo da unidade (e o nome do inquilino); se a busca falhar, a unidade aparece como vaga.
  try {
    const leases = await goFetch<ActiveLease[]>("/api/v1/leases", {})
    activeLease = (leases ?? []).find((l) => l.unit_id === id && l.status === "ACTIVE") ?? null
    if (activeLease) {
      const tenants = await goFetch<{ id: string; name: string }[]>("/api/v1/tenants", {}).catch(() => [])
      tenantName = tenants.find((t) => t.id === activeLease!.tenant_id)?.name ?? "—"
    }
  } catch (error) {
    console.error("Erro ao buscar contratos da unidade:", error)
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-4">
        <Link 
          href={`/properties/${property?.id}`} 
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para {property?.name || 'imóvel'}
        </Link>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Unidade: {unit.label}
              {!unit.is_active && <Badge variant="destructive">Inativa</Badge>}
            </h1>
            <div className="mt-2 text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>
                {property?.address_line 
                  ? `${property.address_line}, ${property.city}/${property.state}`
                  : "Endereço não informado"}
              </span>
            </div>
            {unit.floor && (
              <div className="mt-1 text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Andar: {unit.floor}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Situação Atual</h2>
        
        {activeLease ? (
          <div className="space-y-6">
            <Card className="flex flex-col gap-2 p-4 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{tenantName}</div>
                <div className="text-muted-foreground">
                  {formatCurrency(activeLease.rent_amount)} por mês · desde {formatDateBR(activeLease.start_date)}
                  {activeLease.end_date ? ` até ${formatDateBR(activeLease.end_date)}` : " · sem fim"}
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/leases/${activeLease.id}`}>Ver contrato</Link>
              </Button>
            </Card>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Despesas da Unidade</h3>
                <ExpenseDialog unitId={unit.id} />
              </div>
              <ExpenseList expenses={expenses || []} unitId={unit.id} />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-muted border border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Esta unidade está vaga.</p>
                <p className="text-sm">Não há contrato de locação ativo no momento.</p>
              </div>
              <Button asChild>
                <Link href={`/leases?novo=1&unidade=${unit.id}`}>Criar contrato</Link>
              </Button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Despesas da Unidade</h3>
                <ExpenseDialog unitId={unit.id} />
              </div>
              <ExpenseList expenses={expenses || []} unitId={unit.id} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-8 opacity-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Histórico de Contratos</h2>
          <Badge variant="outline">Em Breve</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          O histórico de inquilinos e contratos antigos aparecerá aqui.
        </p>
      </div>
    </div>
  )
}