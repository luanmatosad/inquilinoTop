import Link from 'next/link'
import { cookies } from 'next/headers'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/auth/actions'
import { Sidebar } from '@/components/Sidebar'
import { getProfile } from '@/app/settings/profile/actions'

import { Search, Bell, Settings, UserCircle } from 'lucide-react'

export default async function Header() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value
  let profileName = ''

  if (accessToken) {
    const profile = await getProfile()
    if (profile?.full_name) {
      profileName = profile.full_name
    }
  }

  return (
    <>
      <Sidebar />
      <header className="h-16 w-full md:w-[calc(100%-16rem)] fixed md:left-64 right-0 top-0 z-40 bg-surface/80 backdrop-blur-md flex justify-between items-center px-4 md:px-8 border-b border-outline-variant shadow-sm">
        <div className="flex items-center text-primary font-bold text-lg md:ml-0 ml-12">
          Painel de Controle
        </div>
        
        <div className="flex items-center space-x-4">
          {!accessToken && (
            <Link href="/login">
              <Button size="sm">Entrar</Button>
            </Link>
          )}
          
          {accessToken && (
            <>
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all w-64"
                />
              </div>
              
              <button className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-full p-2 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              
              <button className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-full p-2 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              
              <Link href="/settings/profile">
                <button className="flex items-center gap-2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-full py-1.5 px-3 transition-colors">
                  <UserCircle className="w-5 h-5" />
                  {profileName && <span className="text-sm font-medium hidden md:block">{profileName}</span>}
                </button>
              </Link>
              
              <form action={logout} className="ml-2">
                <Button variant="outline" size="sm">Sair</Button>
              </form>
            </>
          )}
        </div>
      </header>
    </>
  )
}