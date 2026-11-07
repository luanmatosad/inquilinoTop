import { describe, it, expect, vi, beforeEach } from 'vitest'

const goFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/client', () => ({ goFetch }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createProperty, updateProperty } from '@/app/properties/actions'

beforeEach(() => {
  goFetch.mockReset().mockResolvedValue({ id: 'p1' })
})

const sentBody = () => JSON.parse(goFetch.mock.calls[0][1].body as string)

describe('createProperty', () => {
  it('envia tipo COMMERCIAL, número e complemento ao backend', async () => {
    const r = await createProperty({
      name: 'Centro Empresarial',
      type: 'COMMERCIAL',
      address_line: 'Av. Parintins',
      number: '300',
      complement: 'Sala 2',
    })
    expect(r.success).toBe(true)
    expect(sentBody()).toMatchObject({ type: 'COMMERCIAL', number: '300', complement: 'Sala 2' })
  })

  it('omite número e complemento vazios', async () => {
    await createProperty({ name: 'Casa', type: 'SINGLE', number: '', complement: '' })
    expect(sentBody()).not.toHaveProperty('number')
    expect(sentBody()).not.toHaveProperty('complement')
  })

  it('não chama o backend com número longo demais', async () => {
    const r = await createProperty({ name: 'X', type: 'RESIDENTIAL', number: '9'.repeat(21) })
    expect(r.error).toBe('Dados inválidos')
    expect(goFetch).not.toHaveBeenCalled()
  })
})

describe('updateProperty', () => {
  it('envia número e complemento na edição', async () => {
    await updateProperty('p1', { name: 'Ed. Aurora', type: 'RESIDENTIAL', number: '120', complement: 'Bloco B' })
    expect(goFetch.mock.calls[0][0]).toBe('/api/v1/properties/p1')
    expect(sentBody()).toMatchObject({ number: '120', complement: 'Bloco B' })
  })
})
