import { describe, it, expect } from 'vitest'
import {
  navGroups,
  commandGroups,
  isNavItemActive,
  isPublicRoute,
  mobileTabs,
  moreItems,
  type NavItem,
} from '@/lib/nav'

const allItems = navGroups.flatMap((g) => g.items)
const byHref = (href: string): NavItem => {
  const item = allItems.find((i) => i.href === href)
  if (!item) throw new Error(`item ${href} não existe em navGroups`)
  return item
}
const activeHrefs = (pathname: string) =>
  allItems.filter((i) => isNavItemActive(pathname, i)).map((i) => i.href)

describe('navGroups', () => {
  it('segue a sidebar do canvas: 3 grupos, nessa ordem', () => {
    expect(navGroups.map((g) => g.label)).toEqual(['Gestão', 'Financeiro', 'Administrativo'])
    expect(navGroups[0].items.map((i) => [i.label, i.href])).toEqual([
      ['Hoje', '/'],
      ['Imóveis', '/properties'],
      ['Inquilinos', '/tenants'],
      ['Contratos', '/leases'],
    ])
    expect(navGroups[1].items.map((i) => [i.label, i.href])).toEqual([
      ['Recebimentos', '/financial/receivables'],
      ['Despesas', '/financial/payables'],
      ['Relatórios', '/reports'],
    ])
    expect(navGroups[2].items.map((i) => [i.label, i.href])).toEqual([
      ['Integrações', '/integrations'],
      ['Configurações', '/settings/profile'],
    ])
  })

  it('não expõe Laudos, Importar, Documentos nem Fechamento (sem item de menu no canvas)', () => {
    const labels = allItems.map((i) => i.label)
    for (const label of ['Laudos', 'Importar', 'Documentos', 'Fechamento']) {
      expect(labels).not.toContain(label)
    }
    for (const prefix of ['/inspections', '/import', '/documents', '/closing']) {
      expect(allItems.some((i) => i.href.startsWith(prefix))).toBe(false)
    }
  })

  it('a barra inferior mobile tem Hoje, Imóveis, Inquilinos e Receber', () => {
    expect(mobileTabs.map((i) => [i.mobileTab, i.href])).toEqual([
      ['Hoje', '/'],
      ['Imóveis', '/properties'],
      ['Inquilinos', '/tenants'],
      ['Receber', '/financial/receivables'],
    ])
  })

  it('"Mais" lista os demais itens do menu', () => {
    expect(moreItems.map((i) => i.label)).toEqual([
      'Contratos',
      'Despesas',
      'Relatórios',
      'Integrações',
      'Configurações',
    ])
  })
})

describe('isNavItemActive', () => {
  it('Hoje só ativa em "/" exato', () => {
    expect(activeHrefs('/')).toEqual(['/'])
    expect(activeHrefs('/properties')).not.toContain('/')
  })

  it('Recebimentos ativa nas subrotas, sem ativar Despesas', () => {
    expect(activeHrefs('/financial/receivables')).toEqual(['/financial/receivables'])
    expect(activeHrefs('/financial/receivables/abc/receipt')).toEqual(['/financial/receivables'])
  })

  it('ativa subrotas pelo limite de segmento', () => {
    expect(activeHrefs('/properties/new')).toEqual(['/properties'])
    expect(activeHrefs('/properties/abc/edit')).toEqual(['/properties'])
    expect(activeHrefs('/leases/123')).toEqual(['/leases'])
  })

  it('não confunde prefixos que não são segmento', () => {
    expect(isNavItemActive('/propertiesfoo', byHref('/properties'))).toBe(false)
    expect(isNavItemActive('/lease', byHref('/leases'))).toBe(false)
  })

  it('/settings/* e /owner/settings destacam Configurações', () => {
    for (const path of ['/settings', '/settings/profile', '/settings/team', '/settings/financial', '/settings/notifications', '/settings/security', '/owner/settings']) {
      expect(activeHrefs(path)).toEqual(['/settings/profile'])
    }
  })

  it('rotas fora da sidebar não destacam nada', () => {
    expect(activeHrefs('/support')).toEqual([])
    expect(activeHrefs('/support/tickets')).toEqual([])
    expect(activeHrefs('/inspections')).toEqual([])
    expect(activeHrefs('/import')).toEqual([])
  })
})

describe('isPublicRoute', () => {
  it('login e callback ficam sem shell', () => {
    expect(isPublicRoute('/login')).toBe(true)
    expect(isPublicRoute('/auth/callback')).toBe(true)
  })

  it('página pública da cobrança fica sem shell, mas /payments não', () => {
    expect(isPublicRoute('/p/abc123')).toBe(true)
    expect(isPublicRoute('/p/abc123/recibo')).toBe(true)
    expect(isPublicRoute('/payments')).toBe(false)
    expect(isPublicRoute('/pricing')).toBe(false)
  })

  it('demais rotas usam o shell', () => {
    expect(isPublicRoute('/')).toBe(false)
    expect(isPublicRoute('/properties')).toBe(false)
    expect(isPublicRoute('/loginx')).toBe(false)
    expect(isPublicRoute(null)).toBe(false)
  })
})

describe('commandGroups', () => {
  const hrefs = commandGroups.flatMap((g) => g.items.map((i) => i.href))

  it('inclui todos os destinos da sidebar', () => {
    for (const item of allItems) expect(hrefs).toContain(item.href)
  })

  it('não lista Laudos, Importar, Documentos nem Fechamento', () => {
    const labels = commandGroups.flatMap((g) => g.items.map((i) => i.label.toLowerCase()))
    for (const label of ['laudos', 'importar', 'documentos', 'fechamento']) {
      expect(labels).not.toContain(label)
    }
    for (const prefix of ['/inspections', '/import', '/documents', '/closing']) {
      expect(hrefs.some((h) => h.startsWith(prefix))).toBe(false)
    }
  })

  it('inclui subpáginas de Configurações e Suporte', () => {
    for (const href of [
      '/settings/profile',
      '/settings/team',
      '/settings/financial',
      '/settings/notifications',
      '/settings/security',
      '/support',
      '/support/tickets',
      '/support/new-ticket',
      '/support/contacts',
    ]) {
      expect(hrefs).toContain(href)
    }
  })

  it('não tem hrefs duplicados', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

})
