import { BrandPanel } from '@/components/auth/BrandPanel'
import { LoginForm } from '@/components/auth/LoginForm'

type LoginPageProps = {
  searchParams: Promise<{ mode?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { mode } = await searchParams
  const isSignup = mode === 'signup'

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <LoginForm mode={isSignup ? 'signup' : 'login'} />
      <BrandPanel />
    </div>
  )
}
