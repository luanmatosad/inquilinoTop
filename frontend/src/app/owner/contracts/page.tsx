import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { listLeases } from "@/data/owner/contracts-dal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

function getStatusVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status) {
    case 'ACTIVE': return 'default'
    case 'ENDED': return 'secondary'
    case 'CANCELED': return 'destructive'
    default: return 'secondary'
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
      <div className="flex flex-col items-center justify-center h-64 border border-border rounded-xl bg-card">
        <p className="text-muted-foreground mb-4">Nenhum contrato encontrado.</p>
        <Link href="/owner/contracts/new">
          <Button>Criar Primeiro Contrato</Button>
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Inquilino</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leases.map((lease) => (
          <TableRow key={lease.id}>
            <TableCell className="font-medium">{lease.tenants?.name || '-'}</TableCell>
            <TableCell>{lease.units?.label || '-'}</TableCell>
            <TableCell>
              R$ {Number(lease.rent_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell>{new Date(lease.start_date).toLocaleDateString('pt-BR')}</TableCell>
            <TableCell>
              {lease.end_date ? new Date(lease.end_date).toLocaleDateString('pt-BR') : '-'}
            </TableCell>
            <TableCell>
              <Badge variant={getStatusVariant(lease.status)}>
                {getStatusLabel(lease.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default async function OwnerContractsPage() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Contratos</h1>
          <p className="text-base text-muted-foreground mt-1">
            Gerencie seus contratos de locação.
          </p>
        </div>
        <Link href="/owner/contracts/new">
          <Button variant="secondary">
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