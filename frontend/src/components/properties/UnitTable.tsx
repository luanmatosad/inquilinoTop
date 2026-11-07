import Link from "next/link"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UnitRowActions } from "@/components/properties/UnitRowActions"
import { formatSince, plural } from "@/lib/property-format"
import type { UnitOccupancy } from "@/lib/property-occupancy"

export interface Unit {
  id: string
  label: string
  floor?: string | null
  notes?: string | null
  area_m2?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  is_active: boolean
}

type UnitTableProps = {
  propertyId: string
  units: Unit[]
  /** `null` = contratos indisponíveis: situação e inquilino aparecem como "—". */
  occupancy: Map<string, UnitOccupancy> | null
}

const dash = "—"

function Status({ occ }: { occ?: UnitOccupancy }) {
  if (!occ) return <span className="text-muted-foreground">{dash}</span>
  const rented = occ.status === "RENTED"
  return (
    <Badge variant="outline">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${rented ? "bg-success" : "bg-muted-foreground"}`} />
      {rented ? "Alugada" : "Vaga"}
    </Badge>
  )
}

function Tenant({ occ }: { occ?: UnitOccupancy }) {
  if (!occ?.tenant) return <span className="text-muted-foreground">{dash}</span>
  return (
    <div>
      <div>{occ.tenant.name}</div>
      <div className="text-xs text-muted-foreground">{formatSince(occ.since)}</div>
    </div>
  )
}

const area = (u: Unit) => (u.area_m2 != null ? `${u.area_m2.toLocaleString("pt-BR")} m²` : dash)

/** Desktop: tabela do canvas. Celular (< md): cards com os mesmos dados. */
export function UnitTable({ propertyId, units, occupancy }: UnitTableProps) {
  const addHref = `/properties/${propertyId}?unidade=nova`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href={addHref}>
            <Plus aria-hidden="true" />
            Adicionar unidade
          </Link>
        </Button>
      </div>

      {occupancy === null && (
        <p role="status" className="text-sm text-muted-foreground">
          A ocupação está indisponível no momento. Tente recarregar a página.
        </p>
      )}

      {units.length === 0 ? (
        <div className="rounded-xl bg-muted px-4 py-12 text-center text-muted-foreground">
          Nenhuma unidade cadastrada.
        </div>
      ) : (
        <>
          <Card className="hidden gap-0 overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="px-4">Unidade</TableHead>
                  <TableHead>Andar</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Quartos</TableHead>
                  <TableHead>Banheiros</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Inquilino</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => {
                  const occ = occupancy?.get(u.id)
                  return (
                    <TableRow key={u.id} className="h-16">
                      <TableCell className="px-4 font-medium">{u.label}</TableCell>
                      <TableCell>{u.floor || dash}</TableCell>
                      <TableCell>{area(u)}</TableCell>
                      <TableCell>{u.bedrooms ?? dash}</TableCell>
                      <TableCell>{u.bathrooms ?? dash}</TableCell>
                      <TableCell>
                        <Status occ={occ} />
                      </TableCell>
                      <TableCell>
                        <Tenant occ={occ} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <UnitRowActions propertyId={propertyId} unitId={u.id} label={u.label} isActive={u.is_active} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">{plural(units.length, "unidade", "unidades")}</div>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {units.map((u) => {
              const occ = occupancy?.get(u.id)
              return (
                <li key={u.id}>
                  <Card className="gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{u.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {[u.floor, u.area_m2 != null ? area(u) : null].filter(Boolean).join(" · ") || dash}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Status occ={occ} />
                        <UnitRowActions propertyId={propertyId} unitId={u.id} label={u.label} isActive={u.is_active} />
                      </div>
                    </div>
                    {occ?.tenant && <Tenant occ={occ} />}
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
