import { cookies } from 'next/headers'

import { MobileTabBar } from '@/components/MobileTabBar'
import { Sidebar, type SidebarOrganization } from '@/components/Sidebar'
import { getProfile } from '@/app/settings/profile/actions'
import { goErrorInfo } from '@/lib/go/errors'
import { getOrganization } from '@/lib/go/organization'
import { hasSession } from '@/lib/session'

/**
 * Carrega organização atual (GET /api/v1/organizations/me) e o nome do perfil e entrega ao Sidebar
 * (desktop) e à barra inferior (celular). Sem token, não renderiza nada.
 *
 * E-mail: o backend não expõe fonte do e-mail do usuário logado (GET /auth/profile não traz e-mail,
 * o JWT só tem owner_id/organization_id e `getCurrentUser` chama /auth/me, que não existe).
 * Por isso o e-mail fica vazio e o Sidebar omite a linha até existir um endpoint.
 */
export default async function AppSidebar() {
  const cookieStore = await cookies()
  if (!hasSession(cookieStore)) return null

  const [org, profile] = await Promise.all([
    getOrganization().catch((err: unknown) => {
      // Usuário sem organização é esperado: NO_ORG (401 do middleware rbac) ou 404 NOT_FOUND
      // ("organização não encontrada" de /organizations/me). Usa o fallback sem ruído.
      // Qualquer outra falha (5xx, rede) cai no mesmo fallback, mas fica registrada.
      const { code, status } = goErrorInfo(err)
      const noOrg = code === 'NO_ORG' || (code === 'NOT_FOUND' && status === 404)
      if (!noOrg) {
        console.error('AppSidebar: falha ao carregar organização', err)
      }
      return null
    }),
    getProfile(),
  ])

  const organization: SidebarOrganization | null = org ? { name: org.name, plan: org.plan } : null

  const user = { name: profile?.full_name ?? null, email: null }

  return (
    <>
      <Sidebar organization={organization} user={user} />
      <MobileTabBar user={user} />
    </>
  )
}
