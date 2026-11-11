'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOrganization } from '@/lib/go/organization'

export function OnboardingForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim()
    if (!name) {
      toast.error('Informe o nome da empresa.')
      return
    }
    startTransition(async () => {
      try {
        await createOrganization(name)
        router.replace('/')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível criar a empresa.')
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da empresa</Label>
        <Input id="name" name="name" required maxLength={255} placeholder="Ex.: Administradora Silva Imóveis" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Criando…' : 'Criar empresa'}
        </Button>
      </div>
    </form>
  )
}
