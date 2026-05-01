import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { listLeases } from "@/data/owner/contracts-dal"
import { Button, Badge } from "@heroui/react"

interface LeaseWithDetails {
  id: string
  start_date: string
  end_date: string | null
  rent_amount: number
  payment_day: number
  status: 'ACTIVE' | 'ENDED' | 'CANCELED'
  units: { id: string; property_id: string; label: string } | null
  tenants: { id: string; name: string } | null
}

function getStatusColor(status: string): "success" | "default" | "warning" | "danger" {
  switch (status) {
    case 'ACTIVE': return 'success'
    case 'ENDED': return 'default'
    case 'CANCELED': return 'danger'
    default: return 'default'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Ativo'
    case 'ENDED': return 'Encerrado'
    case 'CANCELED': return 'Cancelado'
    default: return status
  }
}

async function ContractsList() {
  let leases: LeaseWithDetails[] = []

  try {
    leases = await listLeases()
  } catch (error) {
    console.error("Erro ao buscar contratos:", error)
  }

  if (!leases || leases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-outline-variant rounded-xl bg-surface">
        <p className="text-on-surface-variant mb-4">Nenhum contrato encontrado.</p>
        <Link href="/owner/contracts/new">
          <Button>Criar Primeiro Contrato</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Inquilino</th>
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Unidade</th>
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Valor</th>
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Início</th>
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Fim</th>
            <th className="text-left py-3 px-4 text-on-surface-variant font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {leases.map((lease) => (
            <tr key={lease.id} className="border-b border-outline-variant hover:bg-surface-variant/50">
              <td className="py-3 px-4">
                <span className="font-medium">{lease.tenants?.name || '-'}</span>
              </td>
              <td className="py-3 px-4">
                <span>{lease.units?.label || '-'}</span>
              </td>
              <td className="py-3 px-4">
                R$ {Number(lease.rent_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4">
                {new Date(lease.start_date).toLocaleDateString('pt-BR')}
              </td>
              <td className="py-3 px-4">
                {lease.end_date ? new Date(lease.end_date).toLocaleDateString('pt-BR') : '-'}
              </td>
              <td className="py-3 px-4">
                <Badge color={getStatusColor(lease.status)} variant="secondary">
                  {getStatusLabel(lease.status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function OwnerContractsPage() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Meus Contratos</h1>
          <p className="text-base text-on-surface-variant mt-1">
            Gerencie seus contratos de locação.
          </p>
        </div>
        <Link href="/owner/contracts/new">
          <Button className="bg-secondary-container text-on-secondary-container">
            <Plus className="w-4 h-4" />
            Novo Contrato
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando contratos...</div>}>
        <ContractsList />
      </Suspense>
    </div>
  )
}