'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { createPaymentLink, recordPaymentEvent } from '@/app/financial/actions'
import { buildChargeMessage, mailtoUrl } from '@/lib/receivable-detail'
import { whatsappUrl } from '@/lib/whatsapp'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

type Channel = 'WHATSAPP' | 'EMAIL'

type Props = {
  /** Vem da URL (`?enviar=1`). */
  open: boolean
  paymentId: string
  late: boolean
  tenantName: string
  tenantPhone?: string | null
  tenantEmail?: string | null
  month: string
  where: string
  /** Valor da cobrança; atrasada: total atualizado de hoje. */
  amount: number
  dueLabel: string
  /** Pix copia-e-cola; nulo = chave não cadastrada. */
  pix: string | null
  ownerFirstName?: string
}

export function SendChargeDialog(p: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(p.open)
  const [prevOpen, setPrevOpen] = useState(p.open)
  const [channel, setChannel] = useState<Channel>('WHATSAPP')
  const [saving, setSaving] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  // Com o link, a página pública já leva o Pix: a mensagem troca o código pelo endereço.
  const autoMessage = (l: string | null) =>
    buildChargeMessage({
      tenantName: p.tenantName,
      month: p.month,
      where: p.where,
      amount: p.amount,
      dueLabel: p.dueLabel,
      late: p.late,
      pix: l ? null : p.pix,
      link: l,
      ownerFirstName: p.ownerFirstName,
    })
  const [message, setMessage] = useState(() => autoMessage(null))
  if (p.open !== prevOpen) {
    setPrevOpen(p.open)
    setIsOpen(p.open)
  }

  function close() {
    setIsOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('enviar')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Mensagem copiada.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  async function generateLink() {
    setLinking(true)
    try {
      const res = await createPaymentLink(p.paymentId)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      // Texto que o dono não mexeu é refeito; texto editado só ganha (ou troca) o endereço.
      if (message === autoMessage(link)) setMessage(autoMessage(res.url))
      else if (link && message.includes(link)) setMessage(message.replace(link, res.url))
      else setMessage(`${message.trimEnd()}\n\nVeja a cobrança e pague pelo Pix neste link: ${res.url}`)
      setLink(res.url)
      toast.success('Link gerado. O anterior deixou de valer.')
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setLinking(false)
    }
  }

  async function markSent() {
    setSaving(true)
    try {
      const result = await recordPaymentEvent(p.paymentId, p.late ? 'REMINDER' : 'SENT', channel)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(p.late ? 'Lembrete registrado.' : 'Envio registrado.')
      close()
      router.refresh()
    } catch {
      toast.error('Ocorreu um erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  const wa = whatsappUrl(p.tenantPhone, message)
  const mail = mailtoUrl(p.tenantEmail, `Aluguel de ${p.month}`, message)
  const open = channel === 'WHATSAPP' ? wa : mail
  const openLabel = channel === 'WHATSAPP' ? 'Abrir WhatsApp' : 'Abrir e-mail'

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.late ? 'Cobrar de novo' : 'Enviar cobrança'}</DialogTitle>
          <DialogDescription>
            {p.tenantName} · {formatCurrency(p.amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2" role="group" aria-label="Enviar por">
            {(['WHATSAPP', 'EMAIL'] as const).map((c) => (
              <Button key={c} type="button" size="sm" variant={channel === c ? 'default' : 'outline'} aria-pressed={channel === c} onClick={() => setChannel(c)}>
                {c === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'}
              </Button>
            ))}
          </div>

          {!p.pix && (
            <p role="alert" className="text-sm text-destructive">
              Chave Pix não cadastrada: a mensagem sai sem o código Pix.{' '}
              <Link href="/settings/financial" className="underline">
                Cadastrar chave
              </Link>
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Link de pagamento</div>
              <Button type="button" size="sm" variant="outline" onClick={generateLink} disabled={linking}>
                {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {link ? 'Gerar novo link' : 'Gerar link de pagamento'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {link
                ? 'O inquilino vê o Pix, avisa que pagou e baixa o recibo por ele.'
                : 'O inquilino abre sem login, paga pelo Pix e avisa aqui. Gerar um novo link desativa o anterior.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="charge-message" className="text-sm font-medium">
              Mensagem
            </label>
            <Textarea id="charge-message" rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {channel === 'WHATSAPP' && !wa && (
            <p className="text-sm text-muted-foreground">Cadastre o celular do inquilino para enviar pelo WhatsApp.</p>
          )}
          {channel === 'EMAIL' && !mail && (
            <p className="text-sm text-muted-foreground">Cadastre o e-mail do inquilino para enviar por e-mail.</p>
          )}
          <p className="text-sm text-muted-foreground">
            O app abre no seu aparelho com a mensagem pronta. Você envia e depois volta aqui para marcar como enviada.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Voltar
            </Button>
            <Button type="button" variant="outline" onClick={copy}>
              Copiar mensagem
            </Button>
            {open ? (
              <Button asChild variant="outline">
                <a href={open} target="_blank" rel="noreferrer">
                  {openLabel}
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                {openLabel}
              </Button>
            )}
            <Button type="button" onClick={markSent} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Marcar como enviada
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
