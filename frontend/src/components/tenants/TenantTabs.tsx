import Link from 'next/link'

/** Abas do detalhe do inquilino: cada uma é uma rota (Resumo e Extrato). */
export function TenantTabs({ id, active }: { id: string; active: 'resumo' | 'extrato' }) {
  const tabs = [
    { key: 'resumo', label: 'Resumo', href: `/tenants/${id}` },
    { key: 'extrato', label: 'Extrato', href: `/tenants/${id}/extrato` },
  ] as const
  return (
    <nav aria-label="Seções do inquilino" className="flex gap-1 border-b print:hidden">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            active === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
