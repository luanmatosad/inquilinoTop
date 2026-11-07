'use client'

import Link from 'next/link'
import { Check, ListFilter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { propertyTypeLabel } from '@/lib/property-format'

const TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'SINGLE'] as const

type PropertyFiltersProps = { tipo?: string; q?: string }

function hrefFor(q: string | undefined, tipo?: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (tipo) params.set('tipo', tipo)
  const qs = params.toString()
  return qs ? `/properties?${qs}` : '/properties'
}

/** Filtro por tipo. O estado vive na URL (`?tipo=`), então é link direto e funciona sem JS de estado. */
export function PropertyFilters({ tipo, q }: PropertyFiltersProps) {
  const active = TYPES.find((t) => t === tipo)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <ListFilter aria-hidden="true" />
          {active ? `Filtros: ${propertyTypeLabel(active)}` : 'Filtros'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Tipo de imóvel</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={hrefFor(q)}>
            {!active && <Check aria-hidden="true" />}
            Todos os tipos
          </Link>
        </DropdownMenuItem>
        {TYPES.map((t) => (
          <DropdownMenuItem key={t} asChild>
            <Link href={hrefFor(q, t)}>
              {active === t && <Check aria-hidden="true" />}
              {propertyTypeLabel(t)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
