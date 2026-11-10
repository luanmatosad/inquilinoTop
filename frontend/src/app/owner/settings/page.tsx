import { redirect } from 'next/navigation'

// As notificações agora vivem em /settings/notifications (endereço antigo mantido só como redirecionamento).
export default function OwnerSettingsRedirect() {
  redirect('/settings/notifications')
}
