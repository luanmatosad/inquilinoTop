// Ocupação derivada de imóveis + contratos + inquilinos (spec property-occupancy).
// shortcut: junção feita no frontend porque /leases e /tenants não paginam; se a base passar de
// alguns milhares de contratos, mover esta regra para o backend (ver design.md da change).

export type OccupancyProperty = { id: string; units?: { id: string }[] | null }
export type OccupancyLease = { unit_id: string; tenant_id: string; status: string; start_date: string }
export type OccupancyTenant = { id: string; name: string }

export type UnitOccupancy = {
  status: 'RENTED' | 'VACANT'
  tenant: { id: string; name: string } | null
  since: string | null
}

export type OccupancyResult = {
  byUnit: Map<string, UnitOccupancy>
  byProperty: Map<string, { total: number; rented: number }>
  totals: { properties: number; units: number; rented: number; vacant: number }
}

const VACANT: UnitOccupancy = { status: 'VACANT', tenant: null, since: null }

export function buildOccupancy(
  properties: OccupancyProperty[],
  leases: OccupancyLease[],
  tenants: OccupancyTenant[],
): OccupancyResult {
  // Por unidade, vale o contrato ACTIVE de start_date mais recente.
  const current = new Map<string, OccupancyLease>()
  for (const l of leases) {
    if (l.status !== 'ACTIVE') continue
    const prev = current.get(l.unit_id)
    if (!prev || l.start_date > prev.start_date) current.set(l.unit_id, l)
  }
  const tenantById = new Map(tenants.map((t) => [t.id, t]))

  const byUnit = new Map<string, UnitOccupancy>()
  const byProperty = new Map<string, { total: number; rented: number }>()
  let units = 0
  let rented = 0

  for (const p of properties) {
    let propRented = 0
    const propUnits = p.units ?? []
    for (const u of propUnits) {
      const l = current.get(u.id)
      if (!l) {
        byUnit.set(u.id, VACANT)
        continue
      }
      const t = tenantById.get(l.tenant_id)
      byUnit.set(u.id, {
        status: 'RENTED',
        tenant: t ? { id: t.id, name: t.name } : null,
        since: l.start_date,
      })
      propRented++
    }
    byProperty.set(p.id, { total: propUnits.length, rented: propRented })
    units += propUnits.length
    rented += propRented
  }

  return {
    byUnit,
    byProperty,
    totals: { properties: properties.length, units, rented, vacant: units - rented },
  }
}
