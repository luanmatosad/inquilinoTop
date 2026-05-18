'use client'

import * as React from 'react'
import { Upload, X, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/financial/shared'
import { showToast } from '@/lib/sonner'
import { importStatement } from '../../actions'
import type { BankAccount } from '../../actions'

interface ImportStatementModalProps {
  open: boolean
  onClose: () => void
  accounts: BankAccount[]
  currentAccountId: string
  onSuccess: () => void
}

type ModalState = 'idle' | 'submitting' | 'serverError'

export function ImportStatementModal({
  open,
  onClose,
  accounts,
  currentAccountId,
  onSuccess,
}: ImportStatementModalProps) {
  const [state, setState] = React.useState<ModalState>('idle')
  const [dragOver, setDragOver] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [accountId, setAccountId] = React.useState(currentAccountId)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setState('idle')
      setFile(null)
      setDragOver(false)
      setAccountId(currentAccountId)
    }
  }, [open, currentAccountId])

  async function handleSubmit() {
    if (!file) return
    setState('submitting')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('accountId', accountId)
    const res = await importStatement(fd)
    if (res.ok) {
      showToast.success(`Extrato OFX importado. ${res.linesImported} movimentações analisadas.`)
      onSuccess()
      onClose()
    } else {
      setState('serverError')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
        </DialogHeader>

        {state === 'serverError' && (
          <div className="rounded-md bg-[#fee2e2] border border-[#fecaca] px-4 py-3 text-[13px] text-[#7f1010]">
            Erro ao importar o arquivo. Verifique o formato e tente novamente.
          </div>
        )}

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-[12px] border-[1.5px] border-dashed p-8 text-center transition-all"
            style={{
              borderColor: dragOver ? 'var(--primary)' : 'var(--border)',
              background: dragOver ? 'rgba(0,87,190,.05)' : undefined,
            }}
          >
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg border bg-white shadow-sm">
              <Upload className="size-5 text-on-surface-variant" />
            </div>
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[14px] font-medium text-primary">{file.name}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                >
                  <X className="size-4 text-on-surface-variant" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-on-surface">
                  Arraste o arquivo aqui ou clique para escolher
                </p>
                <p className="mt-1 text-[12px] text-on-surface-variant">
                  Formatos suportados: OFX (Nubank, Inter, C6) · CNAB-240 (Itaú, Bradesco, BB, Santander)
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
                  Escolher arquivo
                </Button>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".ofx,.cnab,.txt"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }}
            aria-label="Selecionar arquivo de extrato"
          />

          {/* Account select */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-on-surface-variant">Conta de destino</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank} — {acc.label} (Ag {acc.agency} · CC {acc.number})
                </option>
              ))}
            </select>
          </div>

          {/* Info box */}
          <div className="flex gap-2.5 rounded-[8px] border border-[rgba(0,87,190,.15)] bg-[rgba(0,87,190,.05)] px-4 py-3">
            <Info className="mt-0.5 size-4 flex-shrink-0 text-primary" />
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              O sistema sugere matches automáticos por <strong>valor exato</strong> e <strong>data ± 2 dias</strong>.
              Use o slider de confiança para aprovar sugestões em lote (padrão ≥ 90%).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={state === 'submitting'}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || state === 'submitting'}>
            {state === 'submitting' ? (
              <><Spinner className="mr-2" /> Importando…</>
            ) : (
              <><Upload className="mr-2 size-4" /> Importar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
