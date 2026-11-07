import Link from 'next/link'
import { Bell, ChevronRight, Settings, UserCircle, Users } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Configurações | Inquilino Top',
}

const sections = [
  {
    href: '/settings/profile',
    title: 'Meu Perfil',
    description: 'Dados pessoais, documento e endereço.',
    icon: UserCircle,
  },
  {
    href: '/settings/team',
    title: 'Equipe',
    description: 'Membros da organização, papéis e convites.',
    icon: Users,
  },
  {
    href: '/settings/financial',
    title: 'Config. Financeira',
    description: 'Dados bancários e preferências financeiras.',
    icon: Settings,
  },
  {
    href: '/owner/settings',
    title: 'Notificações',
    description: 'Escolha quais alertas você quer receber.',
    icon: Bell,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seu perfil, equipe e preferências.</p>
      </div>

      <nav aria-label="Seções de configurações">
        <ul className="grid gap-4 sm:grid-cols-2">
          {sections.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group block rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="transition-colors group-hover:bg-accent">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
