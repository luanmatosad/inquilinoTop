import type { TenantFormValues } from '@/lib/schemas'

type AddressSource = {
  postal_code?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
} | null

/**
 * O backend trata PUT /tenants/{id} como substituição total (campos omitidos viram NULL). Como o
 * formulário rápido não mostra o endereço, a edição devolve os valores já gravados em vez de apagá-los.
 */
type Address = Pick<TenantFormValues, 'postal_code' | 'address_line' | 'city' | 'state'>

export function preserveAddress<T extends Partial<TenantFormValues>>(values: T, initial?: AddressSource): T & Address {
  if (!initial) return values as T & Address
  return {
    ...values,
    postal_code: initial.postal_code ?? undefined,
    address_line: initial.address_line ?? undefined,
    city: initial.city ?? undefined,
    state: initial.state ?? undefined,
  }
}
