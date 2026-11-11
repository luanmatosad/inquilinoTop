'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { confirmTwoFactor, disableTwoFactor, startTwoFactor } from './actions'

type Step = { kind: 'idle' } | { kind: 'setup'; secret: string; qrSvg: string } | { kind: 'codes'; codes: string[] }

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run<T>(fn: () => Promise<T>, onOk: (r: Exclude<T, { error: string }>) => void) {
    setBusy(true)
    setError('')
    try {
      const res = await fn()
      if (res && typeof res === 'object' && 'error' in res) setError((res as { error: string }).error)
      else onOk(res as Exclude<T, { error: string }>)
    } catch {
      setError('Ocorreu um erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const start = () => run(startTwoFactor, (r) => setStep({ kind: 'setup', secret: r.secret, qrSvg: r.qrSvg }))
  const confirm = () =>
    run(
      () => confirmTwoFactor(code),
      (r) => {
        setStep({ kind: 'codes', codes: r.backupCodes })
        setCode('')
        setSaved(false)
      },
    )
  const disable = () =>
    run(
      () => disableTwoFactor(password),
      () => {
        toast.success('Verificação em duas etapas desligada.')
        setDisabling(false)
        setPassword('')
        router.refresh()
      },
    )
  const finish = () => {
    setStep({ kind: 'idle' })
    router.refresh()
  }

  const showEnabled = enabled || step.kind === 'codes'

  return (
    <section aria-label="Verificação em duas etapas" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-base font-semibold">Verificação em duas etapas</h3>
          <p className="text-sm text-muted-foreground">Pede um código do app autenticador sempre que você entra em um aparelho novo.</p>
        </div>
        <span className="inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium">{showEnabled ? 'Ligada' : 'Desligada'}</span>
      </div>

      {step.kind === 'idle' && !enabled && (
        <Button className="self-start" onClick={start} disabled={busy}>
          Ativar
        </Button>
      )}
      {step.kind === 'idle' && enabled && (
        <Button className="self-start" variant="outline" onClick={() => setDisabling(true)}>
          Desligar
        </Button>
      )}

      {step.kind === 'setup' && (
        <div className="flex flex-col gap-4">
          <ol className="list-decimal pl-5 text-sm text-muted-foreground">
            <li>Abra o app autenticador e escaneie o QR Code (ou digite a chave).</li>
            <li>Digite o código de 6 dígitos que o app mostra.</li>
          </ol>
          <div role="img" aria-label="QR Code para o app autenticador" className="size-40 rounded-lg bg-white p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: step.qrSvg }} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Chave para digitar</span>
            <code className="break-all rounded bg-muted px-2 py-1 text-sm">{step.secret}</code>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="totp-code">Código de 6 dígitos</Label>
            <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-40" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep({ kind: 'idle' }); setCode(''); setError('') }} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={busy || code.length !== 6}>
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'codes' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Guarde estes códigos de recuperação.</p>
          <p className="text-sm text-muted-foreground">Cada um vale uma vez, se você perder o aparelho. Eles não aparecem de novo.</p>
          <ul aria-label="Códigos de recuperação" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
            {step.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(step.codes.join('\n')).then(() => toast.success('Códigos copiados.'))}>
              Copiar
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              Guardei os códigos
            </label>
            <Button onClick={finish} disabled={!saved} className="ml-auto">
              Concluir
            </Button>
          </div>
        </div>
      )}

      {error && !disabling && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
      )}

      <Dialog open={disabling} onOpenChange={(o) => !busy && setDisabling(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desligar a verificação em duas etapas?</DialogTitle>
            <DialogDescription>Informe a sua senha para confirmar. A conta volta a entrar só com a senha.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disable-password">Senha</Label>
            <Input id="disable-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDisabling(false); setError('') }} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={disable} disabled={busy || !password}>
              Desligar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
