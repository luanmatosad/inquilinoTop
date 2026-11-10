import { getProfile } from './actions'
import { ProfileForm } from './ProfileForm'

export default async function ProfilePage() {
  const profile = await getProfile()

  return (
    <section aria-label="Perfil" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Perfil</h2>
        <p className="text-sm text-muted-foreground">Seus dados de acesso e contato. Também entram nos contratos e nos recibos.</p>
      </div>
      <ProfileForm initialData={profile} />
    </section>
  )
}
