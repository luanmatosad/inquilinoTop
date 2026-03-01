import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/auth/actions'

export default async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="border-b p-4 bg-white shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-primary hover:opacity-80 transition-opacity">
          Inquilino Top
        </Link>
        
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/properties">
                <Button variant="ghost" size="sm">
                  Imóveis
                </Button>
              </Link>
              <Link href="/tenants">
                <Button variant="ghost" size="sm">
                  Inquilinos
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 hidden md:inline-block">
                  {user.email}
                </span>
                <form action={logout}>
                  <Button variant="outline" size="sm">
                    Sair
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Entrar</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
