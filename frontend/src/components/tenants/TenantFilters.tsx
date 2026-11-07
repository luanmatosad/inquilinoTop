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

export const BILLING_FILTERS = [
  { value: 'LATE', label: 'Atrasado' },
  { value: 'PENDING', label: 'Previsto' },
  { value: 'PAID', label: 'Pago' },
  { value: 'NO_LEASE', label: 'Sem contrato' },
] as const

type TenantFiltersProps = { cobranca?: string; q?: string }

function hrefFor(q: string | undefined, cobranca?: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (cobranca) params.set('cobranca', cobranca)
  const qs = params.toString()
  return qs ? `/tenants?${qs}` : '/tenants'
}

/** Filtro por situação de cobrança. O estado vive na URL (`?cobranca=`). */
export function TenantFilters({ cobranca, q }: TenantFiltersProps) {
  const active = BILLING_FILTERS.find((f) => f.value === cobranca)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <ListFilter aria-hidden="true" />
          {active ? `Filtros: ${active.label}` : 'Filtros'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Cobrança do mês</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={hrefFor(q)}>
            {!active && <Check aria-hidden="true" />}
            Todas
          </Link>
        </DropdownMenuItem>
        {BILLING_FILTERS.map((f) => (
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
