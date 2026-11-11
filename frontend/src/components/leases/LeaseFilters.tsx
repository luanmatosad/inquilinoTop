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

const LEASE_STATUS_FILTERS = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'ENDED', label: 'Encerrados' },
  { value: 'CANCELED', label: 'Cancelados' },
] as const

function hrefFor(q?: string, situacao?: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (situacao) params.set('situacao', situacao)
  const qs = params.toString()
  return qs ? `/leases?${qs}` : '/leases'
}

/** Filtro por situação. O estado vive na URL (`?situacao=`). */
export function LeaseFilters({ situacao, q }: { situacao?: string; q?: string }) {
  const active = LEASE_STATUS_FILTERS.find((f) => f.value === situacao)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <ListFilter aria-hidden="true" />
          {active ? `Filtros: ${active.label}` : 'Filtros'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Situação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={hrefFor(q)}>
            {!active && <Check aria-hidden="true" />}
            Todos
          </Link>
        </DropdownMenuItem>
        {LEASE_STATUS_FILTERS.map((f) => (
          <DropdownMenuItem key={f.value} asChild>
            <Link href={hrefFor(q, f.value)}>
              {active?.value === f.value && <Check aria-hidden="true" />}
              {f.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
