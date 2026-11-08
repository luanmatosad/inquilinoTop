'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** QR Code e copia-e-cola do Pix. `qrSvg` é gerado no servidor a partir do código (só traçados, sem texto). */
export function PixPanel({ payload, qrSvg }: { payload: string; qrSvg: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card className="gap-3 p-4">
      <div className="text-sm font-medium">Pague com Pix</div>
      <div
        role="img"
        aria-label="QR Code do Pix"
        className="mx-auto size-[140px] rounded-lg bg-white p-2 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <code className="block break-all rounded-md border bg-input p-3 font-mono text-xs leading-4">{payload}</code>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? 'Código copiado' : 'Copiar código Pix'}
      </Button>
      <p className="text-xs text-muted-foreground">Abra o app do seu banco, escolha Pix e cole o código.</p>
    </Card>
  )
}
