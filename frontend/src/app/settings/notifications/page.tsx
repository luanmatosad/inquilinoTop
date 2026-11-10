import { getOwnerSettings } from '@/data/owner/preferences-dal'
import { NotificationsForm } from './NotificationsForm'

export default async function NotificationsPage() {
  const prefs = await getOwnerSettings()
  return (
    <section aria-label="Notificações" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Notificações</h2>
        <p className="text-sm text-muted-foreground">Escolha o que avisar.</p>
      </div>
      {prefs ? (
        <NotificationsForm prefs={prefs} />
      ) : (
        <p role="status" className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar suas preferências. Recarregue a página.
        </p>
      )}
    </section>
  )
}
