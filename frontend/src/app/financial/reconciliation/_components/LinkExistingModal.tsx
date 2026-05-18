'use client'

import * as React from 'react'
import { Search, ArrowDown, ArrowUp } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { showToast } from '@/lib/sonner'
import { linkLine, searchSuggestions } from '../../actions'
import { fmtBRL, fmtDate } from '@/lib/format'
import type { ReconLine, MatchCandidate } from '../../actions'

interface LinkExistingModalProps {
  open: boolean
  onClose: () => void
  line: ReconLine | null
  onSuccess: () => void
}

export function LinkExistingModal({ open, onClose, line, onSuccess }: LinkExistingModalProps) {
  const [query, setQuery] = React.useState('')
  const [candidates, setCandidates] = React.useState<MatchCandidate[]>([])
  const [loading, setLoading] = React.useState(false)
  const [linking, setLinking] = React.useState(false)

  React.useEffect(() => {
    if (open && line) {
      setQuery('')
      setLoading(true)
      searchSuggestions(line.id).then(res => {
        setCandidates(res)
        setLoading(false)
      })
    }
  }, [open, line])

  const filtered = candidates.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.sub.toLowerCase().includes(query.toLowerCase())
  )

  async function handleLink(candidate: MatchCandidate) {
    if (!line) return
    setLinking(true)
    const res = await linkLine(line.id, candidate.kind, candidate.id)
    if (res.ok) {
      showToast.success('Vínculo criado com sucesso.')
      onSuccess()
      onClose()
    } else {
      showToast.error('Erro ao criar vínculo.')
    }
    setLinking(false)
  }

  if (!line) return null

  const isEntry = line.amount > 0
  const title = isEntry ? 'Vincular linha do extrato a uma cobrança' : 'Vincular linha do extrato a uma despesa'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Line summary */}
          <div className="rounded-[8px] bg-surface-container-low border border-border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11.5px] tabular-nums text-on-surface-variant">{fmtDate(line.date)}</p>
              <p className="text-[13px] font-semibold font-mono text-on-surface mt-0.5">{line.desc}</p>
              <p className="text-[12px] text-on-surface-variant">{line.counterparty}</p>
            </div>
            <p className={`text-[13px] font-semibold tabular-nums ${line.amount > 0 ? 'text-[#15803d]' : 'text-on-surface'}`}>
              {line.amount > 0 ? '+' : ''}{fmtBRL(line.amount)}
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar cobrança por inquilino, imóvel, valor…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-[13px] outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Candidates */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border rounded-md border border-border">
            {loading ? (
              <p className="px-4 py-6 text-center text-[13px] text-on-surface-variant">Buscando…</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-on-surface-variant">Nenhum item encontrado.</p>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => handleLink(c)}
                disabled={linking}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors"
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-[7px] size-7"
                  style={{ background: c.kind === 'receivable' ? 'rgba(34,197,94,.12)' : 'rgba(186,26,26,.08)' }}
                >
                  {c.kind === 'receivable'
                    ? <ArrowDown className="size-3.5 text-[#15803d]" />
                    : <ArrowUp className="size-3.5 text-[#7f1010]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{c.title}</p>
                  <p className="text-[11.5px] text-on-surface-variant">{c.sub}</p>
                </div>
                <p className="text-[13px] font-semibold tabular-nums text-on-surface flex-shrink-0">
                  {fmtBRL(c.amount)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
