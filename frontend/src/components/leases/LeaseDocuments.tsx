'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { validateContractFile } from '@/lib/lease-document'
import { Button } from '@/components/ui/button'

export type LeaseDocument = { id: string; filename: string; created: string }

export function LeaseDocuments({ leaseId, documents }: { leaseId: string; documents: LeaseDocument[] }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const invalid = validateContractFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setLoading(true)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      const res = await fetch(`/api/leases/${leaseId}/documents`, { method: 'POST', body })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Erro ao enviar o arquivo.')
        return
      }
      toast.success('Contrato assinado anexado.')
      router.refresh()
    } catch {
      toast.error('Erro ao enviar o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.length === 0 ? (
        <p className="text-muted-foreground">Nenhum contrato assinado anexado.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {documents.map((d) => (
            <li key={d.id}>
              <a href={`/api/documents/${d.id}`} className="underline" download>
                {d.filename}
              </a>
              <span className="text-muted-foreground"> · {d.created}</span>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept=".pdf,.doc,.docx" className="sr-only" aria-label="Anexar contrato assinado" onChange={onPick} />
      <Button type="button" variant="outline" className="self-start" disabled={loading} onClick={() => input.current?.click()}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Anexar contrato assinado
      </Button>
    </div>
  )
}
