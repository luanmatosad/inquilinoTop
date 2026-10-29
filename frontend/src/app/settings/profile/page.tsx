import { getProfile } from './actions'
import { ProfileForm } from './ProfileForm'

export default async function ProfilePage() {
  const profile = await getProfile()

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas informações pessoais e de contato. Estes dados são necessários para geração de contratos e recebimentos.
        </p>
      </div>

      <div className="bg-background border border-border rounded-xl p-6 shadow-sm">
        <ProfileForm initialData={profile} />
      </div>
    </div>
  )
}
