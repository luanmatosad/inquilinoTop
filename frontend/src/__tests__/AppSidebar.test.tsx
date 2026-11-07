import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const cookieJar = vi.hoisted(() => ({ values: {} as Record<string, string> }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (n in cookieJar.values ? { value: cookieJar.values[n] } : undefined),
  }),
}))

const getOrganization = vi.hoisted(() => vi.fn())
vi.mock('@/lib/go/organization', () => ({ getOrganization }))
const getProfile = vi.hoisted(() => vi.fn())
vi.mock('@/app/settings/profile/actions', () => ({ getProfile }))
vi.mock('@/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/MobileTabBar', () => ({ MobileTabBar: () => null }))

import AppSidebar from '@/components/AppSidebar'

type Props = { organization: unknown; user: { name: string | null } }
// AppSidebar devolve <><Sidebar/><MobileTabBar/></>: [0] é a sidebar do desktop, [1] a barra do celular.
const childrenOf = (el: unknown) => (el as { props: { children: { props: Props }[] } }).props.children
const propsOf = (el: unknown) => childrenOf(el)[0].props

describe('AppSidebar', () => {
  beforeEach(() => {
    cookieJar.values = { access_token: 'a', refresh_token: 'r' }
    getOrganization.mockReset()
    getProfile.mockReset().mockResolvedValue({ full_name: 'Ana Souza' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem sessão não renderiza', async () => {
    cookieJar.values = { access_token: 'a' }
    expect(await AppSidebar()).toBeNull()
  })

  it('passa organização e usuário', async () => {
    getOrganization.mockResolvedValue({ id: '1', name: 'Imob', plan: 'pro' })
    const el = await AppSidebar()
    expect(propsOf(el).organization).toEqual({ name: 'Imob', plan: 'pro' })
    expect(propsOf(el).user.name).toBe('Ana Souza')
  })

  it('entrega o mesmo usuário à barra inferior do celular', async () => {
    getOrganization.mockResolvedValue({ id: '1', name: 'Imob', plan: 'pro' })
    const el = await AppSidebar()
    expect(childrenOf(el)[1].props.user.name).toBe('Ana Souza')
  })

  it('NO_ORG: organização nula, sem log', async () => {
    const err = Object.assign(new Error('sem org'), { code: 'NO_ORG', status: 401 })
    getOrganization.mockRejectedValue(err)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = await AppSidebar()
    expect(propsOf(el).organization).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('404 NOT_FOUND (usuário sem organização): organização nula, sem log', async () => {
    getOrganization.mockRejectedValue(
      Object.assign(new Error('organização não encontrada'), { code: 'NOT_FOUND', status: 404 }),
    )
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = await AppSidebar()
    expect(propsOf(el).organization).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('NOT_FOUND com status diferente de 404 ainda loga', async () => {
    getOrganization.mockRejectedValue(Object.assign(new Error('x'), { code: 'NOT_FOUND', status: 500 }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await AppSidebar()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('erro 5xx: fallback nulo e loga', async () => {
    getOrganization.mockRejectedValue(Object.assign(new Error('boom'), { code: 'INTERNAL', status: 500 }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = await AppSidebar()
    expect(propsOf(el).organization).toBeNull()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('erro de rede: fallback nulo e loga', async () => {
    getOrganization.mockRejectedValue(new TypeError('fetch failed'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = await AppSidebar()
    expect(propsOf(el).organization).toBeNull()
    expect(spy).toHaveBeenCalledOnce()
  })
})
