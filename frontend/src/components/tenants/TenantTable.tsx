import Link from 'next/link'

import { BillingBadge, type BillingDisplay } from '@/components/tenants/BillingBadge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { plural } from '@/lib/property-format'

export type TenantRow = {
  id: string
  name: string
  /** "email · celular", já formatado. */
  contact: string
  /** Documento já mascarado no servidor; o completo nunca chega aqui. */
  document: string
  /** "Unidade · Imóvel", "Sem contrato" ou "—". */
  where: string
  billing: BillingDisplay
}

/** Desktop: tabela do canvas. Celular (< md): cards com os mesmos dados essenciais. */
export function TenantTable({ rows }: { rows: TenantRow[] }) {
  const count = plural(rows.length, 'inquilino', 'inquilinos')
  return (
    <>
      <Card className="hidden gap-0 overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="px-4">Inquilino</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Imóvel e unidade</TableHead>
              <TableHead className="pr-4">Cobrança do mês</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="h-16">
                <TableCell className="px-4">
                  <Link href={`/tenants/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  {r.contact && <div className="text-sm text-muted-foreground">{r.contact}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.document || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{r.where}</TableCell>
                <TableCell className="pr-4">
                  <BillingBadge status={r.billing} />
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
            <Link href={`/tenants/${r.id}`} className="block">
              <Card className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted-foreground">{r.where}</div>
                  </div>
                  <BillingBadge status={r.billing} />
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
