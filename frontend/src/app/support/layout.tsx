import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/support', label: 'Central' },
  { href: '/support/new-ticket', label: 'Novo Chamado' },
  { href: '/support/contacts', label: 'Contatos' },
];

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="space-y-6">
      <nav aria-label="Suporte" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
