import Link from 'next/link'

import { goFetch } from '@/lib/go/client'
import { inferKeyType, type PixSettings } from '@/lib/pix-settings'
import { Button } from '@/components/ui/button'
import { PixDefaultForm } from './PixDefaultForm'
import { UnitPixSection, type UnitRow } from './UnitPixSection'

type ApiProperty = { id: string; name: string; units?: { id: string; label: string }[] | null }

export default async function PixSettingsPage() {
  // O Pix é obrigatório; imóveis (rótulos) e a chave antiga só enriquecem.
  const [pixRes, propertiesRes, legacyRes] = await Promise.allSettled([
    goFetch<PixSettings>('/api/v1/settings/pix', {}),
    goFetch<ApiProperty[]>('/api/v1/properties', {}),
    goFetch<{ pix_key?: string | null }>('/api/v1/payments/config', {}),
  ])

  const heading = (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold">Recebimento (Pix)</h2>
      <p className="text-sm text-muted-foreground">Onde seus inquilinos pagam. O dinheiro vai direto para a sua conta.</p>
    </div>
  )

  if (pixRes.status === 'rejected') {
    console.error('Erro ao buscar o Pix:', pixRes.reason)
    return (
      <section aria-label="Recebimento (Pix)" className="flex flex-col gap-5">
        {heading}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o Pix.</p>
          <Button asChild variant="outline">
            <Link href="/settings/pix">Tentar novamente</Link>
          </Button>
        </div>
      </section>
    )
  }
  if (propertiesRes.status === 'rejected') console.error('Erro ao buscar imóveis:', propertiesRes.reason)

  const pix = pixRes.value
  const legacyKey = legacyRes.status === 'fulfilled' ? legacyRes.value?.pix_key?.trim() : undefined
  const legacy = !pix.default.configured && legacyKey ? { key: legacyKey, type: inferKeyType(legacyKey) ?? ('' as const) } : undefined
  const units: UnitRow[] =
    propertiesRes.status === 'fulfilled' ? (propertiesRes.value ?? []).flatMap((p) => (p.units ?? []).map((u) => ({ id: u.id, label: `${u.label} · ${p.name}` }))) : []

  return (
    <section aria-label="Recebimento (Pix)" className="flex flex-col gap-6">
      {heading}
      <PixDefaultForm value={pix.default} legacy={legacy} />
      {propertiesRes.status === 'rejected' ? (
        <p role="status" className="text-sm text-muted-foreground">
          Imóveis indisponíveis no momento: não dá para escolher outra conta por imóvel agora.
        </p>
      ) : (
        <UnitPixSection units={units} accounts={pix.units} defaultAccount={pix.default} />
      )}
    </section>
  )
}
