import { createClient } from '@/lib/supabase/server'
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

export default async function UnitPage({ 
  params,
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Buscar Unidade e Propriedade
  const { data: unit, error } = await supabase
    .from('units')
    .select(`
      *,
      property:properties(id, name, address_line, city, state)
    `)
    .eq('id', id)
    .single()

  if (error || !unit) {
    notFound()
  }

  // 2. Buscar Contrato Ativo
  const { data: activeLease } = await supabase
    .from('leases')
    .select(`
      *,
      tenant:tenants(name, email, phone)
    `)
    .eq('unit_id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  // 3. Buscar Pagamentos do Contrato Ativo (se existir)
  let payments = []
  if (activeLease) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('lease_id', activeLease.id)
      .order('due_date', { ascending: true })
    payments = data || []
  }

  // 4. Buscar inquilinos para o formulário (se necessário)
  const tenants = !activeLease ? await getActiveTenants() : []

  // 5. Buscar Despesas da Unidade
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('unit_id', id)
    .order('due_date', { ascending: true })

  // Cast para garantir que o tipo do property está correto no TS (embora venha do banco)
  const property = unit.property as unknown as { id: string, name: string, address_line: string, city: string, state: string }

  return (
    <div className="container py-8 space-y-8">
      {/* Breadcrumb / Header */}
      <div className="space-y-4">
        <Link 
          href={`/properties/${property.id}`} 
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para {property.name}
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
                {property.address_line 
                  ? `${property.address_line}, ${property.city}/${property.state}`
                  : "Endereço da propriedade não informado"}
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

      {/* Seção de Contrato */}
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

            {/* Despesas mesmo sem contrato (manutenção, etc) */}
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

      {/* Seção de Histórico (Placeholder) */}
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
