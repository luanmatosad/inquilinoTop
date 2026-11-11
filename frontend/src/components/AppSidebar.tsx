import { cookies } from 'next/headers'

import { MobileTabBar } from '@/components/MobileTabBar'
import { Sidebar } from '@/components/Sidebar'
import { getProfile } from '@/app/settings/profile/actions'
import { hasSession } from '@/lib/session'

/**
 * Carrega nome e e-mail do perfil (GET /auth/profile, que devolve o e-mail de acesso) e entrega ao
 * Sidebar (desktop, que lê a organização do OrganizationProvider) e à barra inferior (celular).
 * Sem token, não renderiza nada.
 */
export default async function AppSidebar() {
  const cookieStore = await cookies()
  if (!hasSession(cookieStore)) return null

  const profile = await getProfile()
  const user = { name: profile?.full_name ?? null, email: profile?.email ?? null }

  return (
    <>
      <Sidebar user={user} />
      <MobileTabBar user={user} />
    </>
  )
}
