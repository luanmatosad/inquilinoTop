import Link from 'next/link'

import { goFetch } from '@/lib/go/client'
import type { Reminder } from '@/lib/message-templates'
import { Button } from '@/components/ui/button'
import { RemindersSection } from './RemindersSection'

export default async function MessagesPage() {
  let reminders: Reminder[] | undefined
  try {
    reminders = (await goFetch<{ reminders: Reminder[] }>('/api/v1/settings/reminders', {})).reminders
  } catch (error) {
    console.error('Erro ao buscar os lembretes:', error)
  }

  return (
    <section aria-label="Mensagens e cobrança" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Mensagens e cobrança</h2>
        <p className="text-sm text-muted-foreground">Quando lembrar e o que dizer. Ao enviar uma cobrança, o ImoviFlow usa o modelo que combina com os dias até o vencimento, e você ainda pode editar antes de enviar.</p>
      </div>
      {reminders ? (
        <RemindersSection reminders={reminders} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens.</p>
          <Button asChild variant="outline">
            <Link href="/settings/messages">Tentar novamente</Link>
          </Button>
        </div>
      )}
    </section>
  )
}
