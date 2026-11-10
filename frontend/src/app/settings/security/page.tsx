import { goFetch } from '@/lib/go/client'
import { PasswordForm } from './PasswordForm'
import { TwoFactorCard } from './TwoFactorCard'

export default async function SecurityPage() {
  let twoFactorEnabled: boolean | undefined
  try {
    const profile = await goFetch<{ two_factor_enabled?: boolean }>('/api/v1/auth/profile', {})
    twoFactorEnabled = !!profile?.two_factor_enabled
  } catch (error) {
    console.error('Erro ao buscar o perfil:', error)
  }

  return (
    <section aria-label="Segurança" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground">Proteja o acesso à sua conta.</p>
      </div>

      <section aria-label="Senha" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <h3 className="text-base font-semibold">Senha</h3>
        <PasswordForm />
      </section>

      {twoFactorEnabled === undefined ? (
        <p role="status" className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar a verificação em duas etapas. Recarregue a página.
        </p>
      ) : (
        <TwoFactorCard enabled={twoFactorEnabled} />
      )}
    </section>
  )
}
