'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, startTransition } from 'react'
import { cn } from '@/lib/utils'

import { LayoutDashboard, Building2, Users, Menu, X, Plus, Wallet, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Send, Percent, BarChart3, Headphones, Phone, FileText, Receipt, CreditCard, Upload, UserCircle, Settings, Bell } from 'lucide-react'

const publicRoutes = ['/login', '/auth/callback']

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/properties', label: 'Imóveis', icon: 'home_work' },
  { href: '/tenants', label: 'Inquilinos', icon: 'groups' },
  { href: '/leases', label: 'Contratos', icon: 'description' },
  { href: '/payments', label: 'Pagamentos', icon: 'payments' },
  { href: '/expenses', label: 'Despesas', icon: 'receipt' },
  { href: '/import', label: 'Importar', icon: 'importar' },
]

const financialItems = [
  { href: '/financial/dashboard', label: 'Dashboard', icon: 'wallet' },
  { href: '/financial/receivables', label: 'Contas a Receber', icon: 'receber' },
  { href: '/financial/payables', label: 'Contas a Pagar', icon: 'pagar' },
  { href: '/financial/reconciliation', label: 'Conciliação Bancária', icon: 'conciliacao' },
  { href: '/financial/transfers', label: 'Repasses', icon: 'repasses' },
  { href: '/financial/commissions', label: 'Comissões', icon: 'comissoes' },
]

const supportItems = [
  { href: '/support', label: 'Central de Suporte', icon: 'support' },
  { href: '/support/new-ticket', label: 'Abrir Chamado', icon: 'newticket' },
  { href: '/support/contacts', label: 'Contatos', icon: 'contacts' },
]

const settingsItems = [
  { href: '/settings/profile', label: 'Meu Perfil', icon: 'user' },
  { href: '/settings/financial', label: 'Config. Financeira', icon: 'settings' },
  { href: '/owner/settings', label: 'Notificações', icon: 'bell' },
]

function getIconComponent(icon: string) {
  switch (icon) {
    case 'dashboard': return LayoutDashboard
    case 'home_work': return Building2
    case 'groups': return Users
    case 'description': return FileText
    case 'payments': return CreditCard
    case 'receipt': return Receipt
    case 'wallet': return Wallet
    case 'receber': return ArrowDownRight
    case 'pagar': return ArrowUpRight
    case 'conciliacao': return ArrowLeftRight
    case 'repasses': return Send
    case 'comissoes': return Percent
    case 'relatorios': return BarChart3
    case 'support': return Headphones
    case 'newticket': return Plus
    case 'contacts': return Phone
    case 'importar': return Upload
    case 'settings': return Settings
    case 'user': return UserCircle
    case 'bell': return Bell
    default: return LayoutDashboard
  }
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (window.innerWidth < 768) {
      startTransition(() => setIsOpen(false))
    }
  }, [pathname])

  if (isPublicRoute) return null

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-3 z-50 p-2 md:hidden text-primary"
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <nav
        className={cn(
          'fixed left-0 top-0 h-screen w-64 border-r border-sidebar-border bg-sidebar flex flex-col py-6 transition-transform duration-300 z-50',
          !isOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
        )}
      >
        <div className="px-6 mb-8 flex items-center justify-between mt-8 md:mt-0">
          <div>
            <h1 className="text-2xl font-bold text-sidebar-primary tracking-tight">PropHero</h1>
            <p className="text-sm text-sidebar-foreground/70">Gestão Imobiliária</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Gestão
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const IconComponent = getIconComponent(item.icon)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'mx-3 my-1 flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <IconComponent className="mr-3 w-5 h-5" />
                {item.label}
              </Link>
            )
          })}

          <div className="px-4 py-2 mt-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Financeiro
          </div>
          {financialItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const IconComponent = getIconComponent(item.icon)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'mx-3 my-1 flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <IconComponent className="mr-3 w-5 h-5" />
                {item.label}
              </Link>
            )
          })}

          <div className="px-4 py-2 mt-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Suporte
          </div>
          {supportItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const IconComponent = getIconComponent(item.icon)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'mx-3 my-1 flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <IconComponent className="mr-3 w-5 h-5" />
                {item.label}
              </Link>
            )
          })}

          <div className="px-4 py-2 mt-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Configurações
          </div>
          {settingsItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const IconComponent = getIconComponent(item.icon)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'mx-3 my-1 flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <IconComponent className="mr-3 w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="px-4 mt-auto">
          <Link
            href="/properties/new"
            className="w-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium rounded-lg py-3 flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="mr-2 w-5 h-5" />
            Novo Imóvel
          </Link>
        </div>
      </nav>
    </>
  )
}