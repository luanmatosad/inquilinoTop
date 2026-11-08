'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'

import { reportPayment } from '@/app/p/[token]/actions'
import { reportSchemaFor, validateProof } from '@/lib/public-charge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { token: string; today: string; defaultAmount: number; landlordFirstName?: string }

const toField = (n: number) => n.toFixed(2).replace('.', ',')

/** "Já paguei" (Inq-2): valor, data e comprovante opcional. Validação repetida no servidor e no backend. */
export function ReportForm({ token, today, defaultAmount, landlordFirstName }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState(toField(defaultAmount))
  const [paidDate, setPaidDate] = useState(today)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{ amount?: string; paid_date?: string; proof?: string; form?: string }>({})
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = reportSchemaFor(today).safeParse({ amount, paid_date: paidDate })
    const next: typeof errors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'amount' ? 'amount' : 'paid_date'
        next[key] ??= issue.message
      }
    }
    const proofError = validateProof(file)
    if (proofError) next.proof = proofError
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const fd = new FormData()
    fd.set('amount', amount)
    fd.set('paid_date', paidDate)
    if (file) fd.set('proof', file, file.name)

    setSaving(true)
    try {
      const result = await reportPayment(token, fd)
      if ('error' in result) {
        setErrors({ form: result.error })
        return
      }
      router.replace(`/p/${token}`)
      router.refresh()
    } catch {
      setErrors({ form: 'Não foi possível enviar o aviso agora. Tente de novo.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-amount">Valor que você pagou</Label>
        <Input id="report-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-date">Data do pagamento</Label>
        <Input id="report-date" type="date" value={paidDate} max={today} onChange={(e) => setPaidDate(e.target.value)} aria-invalid={!!errors.paid_date} />
        {errors.paid_date && <p className="text-xs text-destructive">{errors.paid_date}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="report-proof"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed bg-card p-5 text-center"
        >
          <Upload className="size-6" aria-hidden="true" />
          <span className="text-sm font-medium">{file ? file.name : 'Anexar comprovante'}</span>
          <span className="text-xs font-normal text-muted-foreground">Foto ou PDF · ajuda, mas não é obrigatório</span>
        </Label>
        <input
          id="report-proof"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {errors.proof && <p className="text-xs text-destructive">{errors.proof}</p>}
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <Button type="submit" className="h-11 w-full" disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Avisar que paguei
      </Button>
      <Button asChild variant="ghost" className="h-11 w-full">
        <Link href={`/p/${token}`}>Voltar</Link>
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {landlordFirstName ? `Vamos avisar ${landlordFirstName}. A confirmação é feita depois que o pagamento aparecer na conta.` : 'A confirmação é feita depois que o pagamento aparecer na conta.'}
      </p>
    </form>
  )
}
