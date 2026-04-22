import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ActiveLeaseCard } from '@/components/leases/ActiveLeaseCard'
import { CreateLeaseDialog } from '@/components/leases/CreateLeaseDialog'
import { PaymentList } from '@/components/payments/PaymentList'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { getActiveTenants } from '@/app/leases/actions'
import { goFetch } from '@/lib/go/client'

export default async function UnitPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let unit: any = null
  let property: any = null
  let activeLease: any = null
  let payments: any[] = []
  let expenses: any[] = []

  try {
    unit = await goFetch<any>("/api/v1/units/" + id, {})
    if (unit?.property_id) {
      property = await goFetch<any>("/api/v1/properties/" + unit.property_id, {})
    }
  } catch {
    notFound()
  }

  if (!unit) {
    notFound()
  }

  const tenants = !activeLease ? await getActiveTenants() : []

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
            <ActiveLeaseCard lease={activeLease as any} />
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium mb-4">Pagamentos do Aluguel</h3>
                <PaymentList payments={payments} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Despesas da Unidade</h3>
                  <ExpenseDialog unitId={unit.id} />
                </div>
                <ExpenseList expenses={expenses || []} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gray-50 border border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Esta unidade está vaga.</p>
                <p className="text-sm">Não há contrato de locação ativo no momento.</p>
              </div>
              <CreateLeaseDialog unitId={unit.id} tenants={tenants || []} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Despesas da Unidade</h3>
                <ExpenseDialog unitId={unit.id} />
              </div>
              <ExpenseList expenses={expenses || []} />
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