import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { OccupancyResult } from '@/lib/property-occupancy'
import {
  formatPropertyAddress,
  occupancyLabel,
  plural,
  propertyTypeLabel,
  type AddressParts,
} from '@/lib/property-format'

export type PropertyRow = AddressParts & {
  id: string
  name: string
  type: string
  units?: { id: string }[] | null
}

type PropertyTableProps = {
  properties: PropertyRow[]
  /** `null` = contratos indisponíveis: a ocupação aparece como "—". */
  occupancy: OccupancyResult | null
}

function occupancyText(p: PropertyRow, occupancy: OccupancyResult | null): string {
  const o = occupancy?.byProperty.get(p.id)
  return o ? occupancyLabel(p.type, o) : '—'
}

/** Desktop: tabela. Celular (< md): cards com os mesmos dados (design.md, decisão 7). */
export function PropertyTable({ properties, occupancy }: PropertyTableProps) {
  const unitCount = (p: PropertyRow) => p.units?.length ?? 0
  const totalUnits = properties.reduce((n, p) => n + unitCount(p), 0)

  return (
    <>
      <Card className="hidden gap-0 overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="px-4">Imóvel</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead className="pr-4">Ocupação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((p) => (
              <TableRow key={p.id} className="h-16">
                <TableCell className="px-4">
                  <Link href={`/properties/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">{formatPropertyAddress(p) || 'Sem endereço'}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{propertyTypeLabel(p.type)}</Badge>
                </TableCell>
                <TableCell>{unitCount(p)}</TableCell>
                <TableCell className="pr-4 text-muted-foreground">{occupancyText(p, occupancy)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {plural(properties.length, 'imóvel', 'imóveis')} · {plural(totalUnits, 'unidade', 'unidades')}
        </div>
      </Card>

      <ul className="flex flex-col gap-3 md:hidden">
        {properties.map((p) => (
          <li key={p.id}>
            <Link href={`/properties/${p.id}`} className="block">
              <Card className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPropertyAddress(p, { short: true }) || 'Sem endereço'}
                    </div>
                  </div>
                  <Badge variant="outline">{propertyTypeLabel(p.type)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{occupancyText(p, occupancy)}</div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
