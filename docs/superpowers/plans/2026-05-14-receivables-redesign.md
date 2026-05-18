# Receivables Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `/financial/receivables` atual (Client Component com tokens inválidos e StatusBadge inline) por uma versão Server Component + Client interativo, conectada ao backend Go, seguindo o InquilinoTop Design System.

**Architecture:** `page.tsx` é um Server Component que busca dados em paralelo e passa como props para `ReceivablesClient` (Client Component com tabs/busca/filtro/tabela). O modal "Nova cobrança" é um Client Component separado que submete via Server Action (`createPayment`).

**Tech Stack:** Next.js 15 App Router, shadcn/ui (Dialog, Select, Input, Textarea, Card, Button, DropdownMenu), `useActionState`, sonner toast, `@/lib/format`, `@/components/ui/status-badge`.

---

## File Map

| Ação | Arquivo |
|------|---------|
| Modificar | `frontend/src/app/financial/actions.ts` — adicionar `getActiveLeases`, `createPayment`, exportar `ActiveLease` |
| Substituir | `frontend/src/app/financial/receivables/page.tsx` — Server Component |
| Criar | `frontend/src/app/financial/receivables/_components/ReceivablesClient.tsx` — Client Component |
| Criar | `frontend/src/app/financial/receivables/_components/NewChargeModal.tsx` — Client Component |

---

## Task 1: Adicionar Server Actions em `actions.ts`

**Files:**
- Modify: `frontend/src/app/financial/actions.ts`

### O que adicionar

Dois novos blocos no final de `actions.ts`:

1. Interface + função `getActiveLeases()` — busca leases ACTIVE e tenants em paralelo para montar o label do select.
2. Schema Zod + função `createPayment()` — valida e envia `POST /api/v1/leases/{leaseId}/payments`.

- [ ] **Step 1: Adicionar imports necessários no topo de `actions.ts`**

Adicione `revalidatePath` ao import existente e importe `z` do zod. O arquivo já tem `'use server'` e `goFetch`. O topo deve ficar:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { goFetch } from '@/lib/go/client'
export type { /* ... tipos existentes ... */ } from '@/data/financial/dal'
import type { /* ... tipos existentes ... */ } from '@/data/financial/dal'
```

> **Atenção:** o arquivo atual já importa `goFetch` mas NÃO importa `revalidatePath` nem `z`. Adicione apenas essas duas linhas aos imports existentes — não remova nada.

- [ ] **Step 2: Adicionar interfaces internas e `getActiveLeases` no final do arquivo**

Cole este bloco exatamente após a última função existente (`getBankRecords`):

```ts
// ─── Leases ──────────────────────────────────────────────────────────────────

interface GoLease {
  id: string
  unit_id: string
  tenant_id: string
  rent_amount: number
  status: string
  is_active: boolean
}

interface GoTenant {
  id: string
  name: string
}

export interface ActiveLease {
  id: string
  label: string
}

export async function getActiveLeases(): Promise<ActiveLease[]> {
  try {
    const [leases, tenants] = await Promise.all([
      goFetch<GoLease[]>('/api/v1/leases') ?? [],
      goFetch<GoTenant[]>('/api/v1/tenants') ?? [],
    ])
    const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t.name]))
    return (leases ?? [])
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        id: l.id,
        label: `${tenantMap.get(l.tenant_id) ?? l.id.slice(0, 8)} — R$ ${l.rent_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      }))
  } catch (e) {
    console.error('getActiveLeases:', e)
    return []
  }
}
```

- [ ] **Step 3: Adicionar schema Zod e `createPayment` logo após `getActiveLeases`**

```ts
// ─── Create Payment ───────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  leaseId: z.string().uuid('Contrato inválido'),
  dueDate: z.string().min(1, 'Data de vencimento obrigatória'),
  grossAmount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  type: z.enum(['RENT', 'DEPOSIT', 'EXPENSE', 'OTHER'], {
    errorMap: () => ({ message: 'Tipo inválido' }),
  }),
  competency: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM')
    .optional()
    .or(z.literal('')),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
})

export async function createPayment(
  _prevState: unknown,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const parsed = createPaymentSchema.safeParse({
    leaseId: formData.get('leaseId'),
    dueDate: formData.get('dueDate'),
    grossAmount: formData.get('grossAmount'),
    type: formData.get('type'),
    competency: formData.get('competency') || undefined,
    description: formData.get('description') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }

  const { leaseId, dueDate, grossAmount, type, competency, description } =
    parsed.data

  try {
    await goFetch(`/api/v1/leases/${leaseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        due_date: `${dueDate}T00:00:00Z`,
        gross_amount: grossAmount,
        type,
        ...(competency ? { competency } : {}),
        ...(description ? { description } : {}),
      }),
    })
    revalidatePath('/financial/receivables')
    return { ok: true }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Erro ao criar cobrança',
    }
  }
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /home/aoki/workspace/inquilinoTop/frontend && npx tsc --noEmit 2>&1 | grep "actions.ts"
```

Esperado: nenhuma linha com `actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/financial/actions.ts
git commit -m "feat(financial): add getActiveLeases and createPayment server actions"
```

---

## Task 2: Criar `NewChargeModal.tsx`

**Files:**
- Create: `frontend/src/app/financial/receivables/_components/NewChargeModal.tsx`

O modal usa `useActionState` do React 19 para conectar o `<form>` ao Server Action `createPayment`. Os `<Select>` do shadcn não submetem valor nativo automaticamente — usamos `useState` + `<input type="hidden">` para cada select.

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createPayment } from '../actions'
import type { ActiveLease } from '../actions'

interface NewChargeModalProps {
  open: boolean
  onClose: () => void
  leases: ActiveLease[]
}

const TYPES = [
  { value: 'RENT', label: 'Aluguel' },
  { value: 'DEPOSIT', label: 'Depósito' },
  { value: 'EXPENSE', label: 'Despesa' },
  { value: 'OTHER', label: 'Outro' },
] as const

export function NewChargeModal({ open, onClose, leases }: NewChargeModalProps) {
  const [state, formAction, isPending] = useActionState(
    createPayment,
    null as { ok: true } | { error: string } | null,
  )
  const [leaseId, setLeaseId] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    if (!state) return
    if ('ok' in state && state.ok) {
      toast.success('Cobrança criada com sucesso!')
      setLeaseId('')
      setType('')
      onClose()
    } else if ('error' in state && state.error) {
      toast.error(state.error)
    }
  }, [state, onClose])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="type" value={type} />

          <div className="space-y-1.5">
            <Label>Contrato</Label>
            <Select value={leaseId} onValueChange={setLeaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contrato" />
              </SelectTrigger>
              <SelectContent>
                {leases.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum contrato ativo
                  </SelectItem>
                ) : (
                  leases.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input id="dueDate" name="dueDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grossAmount">Valor (R$)</Label>
              <Input
                id="grossAmount"
                name="grossAmount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="competency">
              Competência{' '}
              <span className="font-normal text-on-surface-variant">(opcional)</span>
            </Label>
            <Input id="competency" name="competency" type="month" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Descrição{' '}
              <span className="font-normal text-on-surface-variant">(opcional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Observações sobre a cobrança..."
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !leaseId || !type}>
              {isPending ? 'Criando...' : 'Criar cobrança'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/aoki/workspace/inquilinoTop/frontend && npx tsc --noEmit 2>&1 | grep "NewChargeModal"
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/financial/receivables/_components/NewChargeModal.tsx
git commit -m "feat(receivables): add NewChargeModal connected to createPayment action"
```

---

## Task 3: Criar `ReceivablesClient.tsx`

**Files:**
- Create: `frontend/src/app/financial/receivables/_components/ReceivablesClient.tsx`

Client Component que recebe `receivables` e `leases` como props e gerencia todo o estado interativo da tela.

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import * as React from 'react'
import { useState } from 'react'
import { Search, Plus, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/ui/status-badge'
import { fmtBRL, fmtDate } from '@/lib/format'
import { NewChargeModal } from './NewChargeModal'
import type { ActiveLease, Receivable, TransactionStatus } from '../actions'

type TabId = 'RENT' | 'OTHER'
type StatusFilter = TransactionStatus | 'ALL'

const METHOD_LABEL: Record<string, string> = {
  BOLETO: 'Boleto',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão',
}

const TABLE_COLS = ['Vencimento', 'Pagador', 'Valor', 'Método', 'Status', '']

interface ReceivablesClientProps {
  receivables: Receivable[]
  leases: ActiveLease[]
}

export function ReceivablesClient({ receivables, leases }: ReceivablesClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('RENT')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = receivables.filter((item) => {
    const matchTab =
      activeTab === 'RENT' ? item.type === 'RENT' : item.type !== 'RENT'
    const matchStatus =
      filterStatus === 'ALL' || item.status === filterStatus
    const q = searchTerm.toLowerCase()
    const matchSearch =
      q === '' ||
      item.payer.toLowerCase().includes(q) ||
      item.property.toLowerCase().includes(q)
    return matchTab && matchStatus && matchSearch
  })

  const countRent = receivables.filter((r) => r.type === 'RENT').length
  const countOther = receivables.filter((r) => r.type !== 'RENT').length

  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Contas a receber
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Módulo financeiro · gestão de cobranças
          </p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Nova cobrança
        </Button>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-border">
        {(
          [
            { id: 'RENT', label: 'Aluguel', count: countRent },
            { id: 'OTHER', label: 'Outras cobranças', count: countOther },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'pb-3 text-sm font-medium transition-colors inline-flex items-center gap-1.5',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {tab.label}
            <span className="rounded-full bg-surface-variant px-1.5 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Toolbar ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            className="pl-9"
            placeholder="Buscar por pagador ou imóvel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="PAID">Pago</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="OVERDUE">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-variant">
                {TABLE_COLS.map((col, i) => (
                  <th
                    key={i}
                    className={[
                      'px-4 py-3 text-xs font-medium uppercase tracking-wide text-on-surface-variant',
                      i === 0 ? 'pl-6' : '',
                      i === TABLE_COLS.length - 1
                        ? 'pr-6 text-right'
                        : 'text-left',
                    ].join(' ')}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_COLS.length}
                    className="py-12 text-center text-sm text-on-surface-variant"
                  >
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-surface-container-low"
                  >
                    <td className="py-3 pl-6 pr-4 text-[13px] whitespace-nowrap text-on-surface-variant">
                      {fmtDate(item.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[180px] truncate font-semibold text-on-surface">
                        {item.payer}
                      </p>
                      <p className="max-w-[180px] truncate text-xs text-on-surface-variant">
                        {item.property}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-on-surface whitespace-nowrap">
                      {fmtBRL(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 pl-4 pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary">
                            <MoreVertical className="size-4" />
                            <span className="sr-only">Ações</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status === 'OVERDUE' && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`/financial/receivables?charge=${item.id}`}
                              >
                                Cobrar via WhatsApp
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem disabled={item.status !== 'PAID'}>
                            Ver recibo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <NewChargeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leases={leases}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/aoki/workspace/inquilinoTop/frontend && npx tsc --noEmit 2>&1 | grep "ReceivablesClient"
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/financial/receivables/_components/ReceivablesClient.tsx
git commit -m "feat(receivables): add ReceivablesClient with tabs, search, filter, and table"
```

---

## Task 4: Substituir `page.tsx` como Server Component

**Files:**
- Modify: `frontend/src/app/financial/receivables/page.tsx`

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

```tsx
import React from 'react'
import { getReceivables, getActiveLeases } from '../actions'
import { ReceivablesClient } from './_components/ReceivablesClient'

export default async function ReceivablesPage() {
  const [receivables, leases] = await Promise.all([
    getReceivables(),
    getActiveLeases(),
  ])

  return (
    <div className="space-y-6">
      <ReceivablesClient receivables={receivables} leases={leases} />
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript completo**

```bash
cd /home/aoki/workspace/inquilinoTop/frontend && npx tsc --noEmit 2>&1 | grep -v "leases/page\|payments/page\|units/\[id\]\|settings/financial\|CreateLeaseDialog\|example.test\|Sidebar.test"
```

Esperado: zero linhas com `receivables` ou `actions.ts`.

- [ ] **Step 3: Lint**

```bash
cd /home/aoki/workspace/inquilinoTop/frontend && npx next lint 2>&1 | tail -3
```

Esperado: `Errors: 0 | Warnings: 0`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/financial/receivables/page.tsx
git commit -m "feat(receivables): rewrite page as Server Component using ReceivablesClient"
```
