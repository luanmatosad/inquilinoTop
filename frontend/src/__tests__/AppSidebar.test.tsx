import { describe, it, expect, vi, beforeEach } from 'vitest'

const cookieJar = vi.hoisted(() => ({ values: {} as Record<string, string> }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (n in cookieJar.values ? { value: cookieJar.values[n] } : undefined),
  }),
}))

const getProfile = vi.hoisted(() => vi.fn())
vi.mock('@/app/settings/profile/actions', () => ({ getProfile }))
vi.mock('@/components/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/MobileTabBar', () => ({ MobileTabBar: () => null }))

import AppSidebar from '@/components/AppSidebar'

type Props = { user: { name: string | null; email: string | null } }
// AppSidebar devolve <><Sidebar/><MobileTabBar/></>: [0] é a sidebar do desktop, [1] a barra do celular.
const childrenOf = (el: unknown) => (el as { props: { children: { props: Props }[] } }).props.children

describe('AppSidebar', () => {
  beforeEach(() => {
    cookieJar.values = { access_token: 'a', refresh_token: 'r' }
    getProfile.mockReset().mockResolvedValue({ full_name: 'Ana Souza' })
  })

  it('sem sessão não renderiza', async () => {
    cookieJar.values = { access_token: 'a' }
    expect(await AppSidebar()).toBeNull()
  })

  it('entrega o nome do perfil ao Sidebar e à barra do celular', async () => {
    const el = await AppSidebar()
    expect(childrenOf(el)[0].props.user.name).toBe('Ana Souza')
    expect(childrenOf(el)[1].props.user.name).toBe('Ana Souza')
  })

  it('entrega o e-mail do perfil ao Sidebar e à barra do celular', async () => {
    getProfile.mockResolvedValue({ full_name: 'Ana Souza', email: 'ana@example.com' })
    const el = await AppSidebar()
    expect(childrenOf(el)[0].props.user.email).toBe('ana@example.com')
    expect(childrenOf(el)[1].props.user.email).toBe('ana@example.com')
  })
})
