import { OnboardingForm } from './OnboardingForm'

export default function OnboardingPage() {
  return (
    <section aria-label="Criar empresa" className="mx-auto flex w-full max-w-md flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Crie sua empresa</h1>
        <p className="text-sm text-muted-foreground">Nome da administradora ou imobiliária que vai usar o InquilinoTop.</p>
      </div>
      <OnboardingForm />
    </section>
  )
}
