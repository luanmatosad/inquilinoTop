'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsUpDown } from 'lucide-react'

import { logout } from '@/app/auth/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { isNavItemActive, navGroups } from '@/lib/nav'

export type SidebarOrganization = {
  name: string
  plan?: string | null
}

export type SidebarUser = {
  name?: string | null
  email?: string | null
}

type SidebarProps = {
  /** Organização atual (somente exibição, sem troca). `null` usa um texto neutro. */
  organization: SidebarOrganization | null
  user: SidebarUser
}

export const FALLBACK_ORGANIZATION_NAME = 'Organização'

export function getInitials(value: string): string {
  const parts = value
    .replace(/@.*$/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  const letters =
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]
  return letters.toUpperCase()
}

function formatPlan(plan?: string | null): string | null {
  if (!plan) return null
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
}

export function Sidebar({ organization, user }: SidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const orgName = organization?.name?.trim() || FALLBACK_ORGANIZATION_NAME
  const orgPlan = formatPlan(organization?.plan)
  const userName = user.name?.trim() || user.email || 'Usuário'
  const userEmail = user.email ?? ''

  // No drawer mobile, fecha ao navegar.
  const closeMobile = () => setOpenMobile(false)

  return (
    <SidebarRoot aria-label="Navegação principal">
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-2.5 rounded-lg p-2" data-slot="organization">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              {getInitials(orgName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col leading-[1.35]">
            <span className="truncate text-sm font-bold text-foreground">{orgName}</span>
            {orgPlan && <span className="truncate text-xs text-muted-foreground">{orgPlan}</span>}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-6 p-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="h-6 rounded-sm px-2 py-1.5 leading-3 text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className="gap-1 rounded-sm font-normal data-active:font-normal"
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={closeMobile}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-hidden ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2 data-[state=open]:bg-sidebar-accent"
            >
              <Avatar className="size-8 border-2 border-border">
                <AvatarFallback className="bg-muted text-sm tracking-tight text-muted-foreground">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-sm font-medium text-foreground">{userName}</span>
                {userEmail && (
                  <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                )}
              </span>
              <ChevronsUpDown className="size-5 shrink-0 text-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'top' : 'right'}
            align="end"
            sideOffset={8}
            className="min-w-56"
          >
            <DropdownMenuLabel className="flex flex-col gap-px font-normal">
              <span className="truncate text-sm font-medium text-foreground">{userName}</span>
              {userEmail && (
                <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" onClick={closeMobile}>
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logout}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer">
                  Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </SidebarRoot>
  )
}
