import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { plural } from '@/lib/property-format'

export type LeaseTableRow = {
  id: string
  unit: string
  property: string
  tenant: string
  start: string
  /** Já formatado; "Sem fim" quando aberto. */
  end: string
  rent: string
  /** "MM/AAAA", "pendente" ou "—". */
  readjust: string
  readjustPending: boolean
  status: string
  statusLabel: string
}

const VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  ENDED: 'secondary',
  CANCELED: 'destructive',
}

/** Desktop: tabela do canvas. Celular (< md): cards. */
export function LeaseTable({ rows }: { rows: LeaseTableRow[] }) {
  const count = plural(rows.length, 'contrato', 'contratos')
  return (
    <>
      <Card size="flush" className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="px-4">Unidade</TableHead>
              <TableHead>Inquilino</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Aluguel</TableHead>
              <TableHead>Próx. reajuste</TableHead>
              <TableHead className="pr-4">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="h-16">
                <TableCell className="px-4">
                  <Link href={`/leases/${r.id}`} className="font-medium hover:underline">
                    {r.unit}
                  </Link>
                  <div className="text-sm text-muted-foreground">{r.property}</div>
                </TableCell>
                <TableCell>{r.tenant}</TableCell>
                <TableCell className="text-muted-foreground">{r.start}</TableCell>
                <TableCell className="text-muted-foreground">{r.end}</TableCell>
                <TableCell>{r.rent}</TableCell>
                <TableCell className={r.readjustPending ? 'text-destructive' : 'text-muted-foreground'}>{r.readjust}</TableCell>
                <TableCell className="pr-4">
                  <Badge variant={VARIANT[r.status] ?? 'secondary'}>{r.statusLabel}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">{count}</div>
      </Card>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/leases/${r.id}`} className="block">
              <Card className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{r.unit}</div>
                    <div className="text-sm text-muted-foreground">{r.tenant} · {r.property}</div>
                  </div>
                  <Badge variant={VARIANT[r.status] ?? 'secondary'}>{r.statusLabel}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{r.rent} · {r.end}</div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
