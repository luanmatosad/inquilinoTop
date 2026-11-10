import { SettingsNav } from '@/components/settings/SettingsNav'

export const metadata = {
  title: 'Configurações | Inquilino Top',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="hidden flex-col gap-1 md:flex">
        <h1 className="text-2xl font-semibold leading-[1.2]">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste o ImoviFlow do seu jeito.</p>
      </header>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-10">
        <SettingsNav />
        <div className="min-w-0 max-w-[640px] flex-1">{children}</div>
      </div>
    </div>
  )
}
