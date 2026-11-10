// Seções de Configurações, na ordem do canvas. Única definição: menu lateral e lista do celular leem daqui.
export type SettingsSection = {
  key: string
  label: string
  description: string
  /** Sem `href` a seção ainda não tem tela (selo "Em breve"). */
  href?: string
  soon?: boolean
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'profile', label: 'Perfil', description: 'Seus dados de acesso e contato.', href: '/settings/profile' },
  { key: 'branding', label: 'Personalização', description: 'Logo, nome e cor nos recibos.', soon: true },
  { key: 'team', label: 'Equipe e permissões', description: 'Quem ajuda na administração.', href: '/settings/team' },
  { key: 'plan', label: 'Plano e cobrança', description: 'O que você paga ao ImoviFlow.', soon: true },
  { key: 'pix', label: 'Recebimento (Pix)', description: 'Onde seus inquilinos pagam.', href: '/settings/pix' },
  { key: 'messages', label: 'Mensagens e cobrança', description: 'Quando lembrar e o que dizer.', soon: true },
  { key: 'rules', label: 'Regras financeiras', description: 'Multa, juros e reajuste padrão.', href: '/settings/rules' },
  { key: 'categories', label: 'Categorias de despesa', description: 'Organizam despesas e relatórios.', soon: true },
  { key: 'notifications', label: 'Notificações', description: 'Escolha o que avisar.', href: '/settings/notifications' },
  { key: 'security', label: 'Segurança', description: 'Senha e verificação em duas etapas.', href: '/settings/security' },
  { key: 'privacy', label: 'Privacidade e dados', description: 'Seus dados e os dos seus inquilinos.', soon: true },
]

/** A seção cuja tela está aberta (`/settings` sozinho não tem seção). */
export function activeSection(pathname: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((s) => s.href && (pathname === s.href || pathname.startsWith(`${s.href}/`)))
}
