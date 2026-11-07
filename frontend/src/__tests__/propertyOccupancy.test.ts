import { describe, it, expect } from 'vitest'

import { buildOccupancy } from '@/lib/property-occupancy'

const unit = (id: string) => ({ id })
const property = (id: string, ...units: string[]) => ({ id, units: units.map(unit) })
const lease = (unit_id: string, tenant_id: string, status: string, start_date = '2025-03-10') => ({
  unit_id,
  tenant_id,
  status,
  start_date,
})
const tenant = (id: string, name: string) => ({ id, name })

describe('buildOccupancy · situação da unidade', () => {
  it('contrato ACTIVE deixa a unidade alugada', () => {
    const r = buildOccupancy([property('p1', 'u1')], [lease('u1', 't1', 'ACTIVE')], [tenant('t1', 'Marina')])
    expect(r.byUnit.get('u1')?.status).toBe('RENTED')
  })

  it.each(['ENDED', 'CANCELED'])('contrato %s não deixa a unidade alugada', (status) => {
    const r = buildOccupancy([property('p1', 'u1')], [lease('u1', 't1', status)], [tenant('t1', 'Marina')])
    expect(r.byUnit.get('u1')).toEqual({ status: 'VACANT', tenant: null, since: null })
  })

  it('unidade sem contrato é vaga', () => {
    const r = buildOccupancy([property('p1', 'u1')], [], [])
    expect(r.byUnit.get('u1')).toEqual({ status: 'VACANT', tenant: null, since: null })
  })
})

describe('buildOccupancy · inquilino atual', () => {
  it('traz nome do inquilino e início do contrato', () => {
    const r = buildOccupancy(
      [property('p1', 'u1')],
      [lease('u1', 't1', 'ACTIVE', '2025-03-10')],
      [tenant('t1', 'Marina Souza')],
    )
    expect(r.byUnit.get('u1')).toEqual({
      status: 'RENTED',
      tenant: { id: 't1', name: 'Marina Souza' },
      since: '2025-03-10',
    })
  })

  it('com dois contratos ACTIVE vale o de start_date mais recente', () => {
    const r = buildOccupancy(
      [property('p1', 'u1')],
      [lease('u1', 't1', 'ACTIVE', '2024-01-01'), lease('u1', 't2', 'ACTIVE', '2025-06-01')],
      [tenant('t1', 'Antigo'), tenant('t2', 'Novo')],
    )
    expect(r.byUnit.get('u1')?.tenant?.name).toBe('Novo')
    expect(r.byUnit.get('u1')?.since).toBe('2025-06-01')
  })

  it('inquilino ausente da lista: segue alugada, sem nome e sem erro', () => {
    const r = buildOccupancy([property('p1', 'u1')], [lease('u1', 'fantasma', 'ACTIVE')], [])
    expect(r.byUnit.get('u1')).toEqual({ status: 'RENTED', tenant: null, since: '2025-03-10' })
  })
})

describe('buildOccupancy · totais', () => {
  const properties = [property('p1', 'u1', 'u2', 'u3'), property('p2', 'u4'), property('p3')]
  const leases = [lease('u1', 't1', 'ACTIVE'), lease('u4', 't2', 'ACTIVE'), lease('u2', 't3', 'ENDED')]
  const tenants = [tenant('t1', 'A'), tenant('t2', 'B'), tenant('t3', 'C')]

  it('por imóvel: total de unidades e alugadas', () => {
    const r = buildOccupancy(properties, leases, tenants)
    expect(r.byProperty.get('p1')).toEqual({ total: 3, rented: 1 })
    expect(r.byProperty.get('p2')).toEqual({ total: 1, rented: 1 })
    expect(r.byProperty.get('p3')).toEqual({ total: 0, rented: 0 })
  })

  it('indicadores: imóveis, unidades, alugadas e vagas', () => {
    const r = buildOccupancy(properties, leases, tenants)
    expect(r.totals).toEqual({ properties: 3, units: 4, rented: 2, vacant: 2 })
  })

  it('exemplo do canvas: 5 imóveis, 14 unidades, 5 alugadas, 9 vagas', () => {
    const props = [
      property('a', 'a1', 'a2', 'a3'),
      property('b', 'b1', 'b2'),
      property('c', 'c1'),
      property('d', 'd1', 'd2', 'd3', 'd4'),
      property('e', 'e1', 'e2', 'e3', 'e4'),
    ]
    const ls = ['a3', 'b1', 'c1', 'd1', 'e1'].map((u, i) => lease(u, `t${i}`, 'ACTIVE'))
    expect(buildOccupancy(props, ls, []).totals).toEqual({ properties: 5, units: 14, rented: 5, vacant: 9 })
  })

  it('lista vazia', () => {
    const r = buildOccupancy([], [], [])
    expect(r.totals).toEqual({ properties: 0, units: 0, rented: 0, vacant: 0 })
    expect(r.byUnit.size).toBe(0)
  })

  it('contrato de unidade que não existe nos imóveis é ignorado', () => {
    const r = buildOccupancy([property('p1', 'u1')], [lease('outra', 't1', 'ACTIVE')], [])
    expect(r.totals.rented).toBe(0)
  })
})
