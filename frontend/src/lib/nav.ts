import {
  Bell,
  Building2,
  ChartColumn,
  FileText,
  Headphones,
  LifeBuoy,
  Phone,
  Plug,
  Receipt,
  Settings,
  Sun,
  Ticket,
  UserCircle,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Prefixos que também destacam o item (padrão: o próprio href). */
  match?: string[]
  /** Rótulo da aba na barra inferior mobile. Itens sem ele caem em "Mais". */
  mobileTab?: string
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

// Sidebar conforme o canvas "ImoviFlow — Telas" (fonte da verdade): 3 grupos, 9 itens.
// Sem item de menu no canvas: Laudos, Importar, Documentos e Fechamento. As rotas
// /inspections e /import continuam existindo, só não aparecem na navegação.
// Recebimentos e Despesas apontam para /financial/*; as rotas serão revistas na Onda 1.
export const navGroups: NavGroup[] = [
  {
    label: 'Gestão',
    items: [
      { href: '/', label: 'Hoje', icon: Sun, mobileTab: 'Hoje' },
      { href: '/properties', label: 'Imóveis', icon: Building2, mobileTab: 'Imóveis' },
      { href: '/tenants', label: 'Inquilinos', icon: Users, mobileTab: 'Inquilinos' },
      { href: '/leases', label: 'Contratos', icon: FileText },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        href: '/financial/receivables',
        label: 'Recebimentos',
        icon: Receipt,
        mobileTab: 'Receber',
      },
      { href: '/financial/payables', label: 'Despesas', icon: Wallet },
      { href: '/reports', label: 'Relatórios', icon: ChartColumn },
    ],
  },
  {
    label: 'Administrativo',
    items: [
      { href: '/integrations', label: 'Integrações', icon: Plug },
      {
        href: '/settings',
        label: 'Configurações',
        icon: Settings,
        // Notificações vive em /owner/settings mas é uma configuração.
        match: ['/settings', '/owner/settings'],
      },
    ],
  },
]

const allNavItems = navGroups.flatMap((g) => g.items)

/** Abas da barra inferior mobile, na ordem da sidebar. */
export const mobileTabs: NavItem[] = allNavItems.filter((i) => i.mobileTab)

/** Itens listados na aba "Mais" do mobile: todos que não são aba. */
export const moreItems: NavItem[] = allNavItems.filter((i) => !i.mobileTab)

// Destinos extras da paleta de comandos (⌘K): só navegação entre páginas.
const settingsPages: NavItem[] = [
  { href: '/settings/profile', label: 'Meu Perfil', icon: UserCircle },
  { href: '/settings/team', label: 'Equipe', icon: Users },
  { href: '/settings/financial', label: 'Config. Financeira', icon: Settings },
  { href: '/owner/settings', label: 'Notificações', icon: Bell },
]

const supportPages: NavItem[] = [
  { href: '/support', label: 'Central de Suporte', icon: LifeBuoy },
  { href: '/support/tickets', label: 'Meus Chamados', icon: Ticket },
  { href: '/support/new-ticket', label: 'Abrir Chamado', icon: Headphones },
  { href: '/support/contacts', label: 'Contatos', icon: Phone },
]

export const commandGroups: NavGroup[] = [
  ...navGroups,
  { label: 'Configurações', items: settingsPages },
  { label: 'Suporte', items: supportPages },
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return (item.match ?? [item.href]).some((p) => matchesPrefix(pathname, p))
}

// '/p': página pública da cobrança (o token no endereço é a credencial; sem sessão, sem menu).
export const publicRoutes = ['/login', '/auth/callback', '/p']

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return publicRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}
