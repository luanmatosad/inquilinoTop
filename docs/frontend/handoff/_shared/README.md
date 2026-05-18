# `_shared/` — utilitários comuns a todas as fases

Estes arquivos são consumidos por mais de uma fase. Crie-os **uma única vez** (provavelmente na Phase 1, junto do refinamento de Receivables) e reuse nas fases seguintes.

| Arquivo                                         | Destino no repo                                                    | Quando criar  |
|-------------------------------------------------|--------------------------------------------------------------------|---------------|
| `status-badge.tsx`                              | `frontend/src/components/ui/status-badge.tsx`                      | Fase 1 (estender) |
| `financial-shared.tsx`                          | `frontend/src/components/financial/shared.tsx`                     | Fase 1        |

`format.ts` (em `@/lib/format`) **já existe** no repo (criado no handoff do dashboard) — não recrie.

---

## `status-badge.tsx` — extensão da paleta

A versão atual no repo cobre `PAID / PENDING / OVERDUE / REVIEW / RECONCILED / NEW / NEUTRAL`. Adicione `SCHEDULED` (pagamento agendado, usado em Payables e Transfers).

Diff sugerido:

```tsx
// frontend/src/components/ui/status-badge.tsx
// ...
const palette = {
  PAID:       { bg: '#d1fadf', fg: '#15803d', dot: '#22c55e', label: 'Pago'        },
  PENDING:    { bg: '#fff0c2', fg: '#b45309', dot: '#f59e0b', label: 'Pendente'    },
  OVERDUE:    { bg: '#fee2e2', fg: '#7f1010', dot: 'var(--destructive)', label: 'Atrasado' },
  // + ADD:
  SCHEDULED:  { bg: '#dbe7ff', fg: '#00366f', dot: '#2563eb', label: 'Agendado'    },
  // existing:
  REVIEW:     { bg: '#dbe7ff', fg: '#00366f', dot: '#2563eb', label: 'Em revisão'  },
  RECONCILED: { bg: '#eef2ff', fg: '#3730a3', dot: '#646be3', label: 'Conciliado'  },
  NEW:        { bg: '#ffe5bf', fg: '#6f3c00', dot: 'var(--secondary)', label: 'Novo' },
  NEUTRAL:    { bg: 'var(--surface-container)', fg: 'var(--on-surface-variant)', dot: 'var(--on-surface-variant)', label: '—' },
} as const;

export type StatusKind = keyof typeof palette;
```

Os dois usos (`REVIEW` e `SCHEDULED`) ficam com cores idênticas — proposital, porque ambos significam "aguardando" mas em contextos diferentes (revisão de repasse vs. débito programado). A label distingue.

---

## `financial-shared.tsx`

Helpers visuais usados por Receivables, Payables, Transfers e (futuramente) Reconciliation. Mock fonte: `../Contas a receber.html` + `../Contas a pagar.html`. Os arquivos em `ui_kit/financial-shared.jsx` no projeto de design system são a referência.

API exportada:

```tsx
// frontend/src/components/financial/shared.tsx
'use client'; // só para Toast (state). Skeleton/Error/Empty podem ficar em arquivos próprios sem 'use client' se preferir.

import { AlertTriangle, ArrowLeftRight, Bell, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------ TableSkeleton ------------------ */

interface TableSkeletonProps {
  /** Header labels — one per column. Use empty string for the actions column. */
  headers: string[];
  /** Widths per column. Number = single line. [w1,w2] = two stacked lines. */
  columnWidths: (number | [number, number])[];
  /** Default 6 rows. */
  rows?: number;
  /** Padding for each cell. Default 'py-3 px-4'. */
  rowClassName?: string;
}

export function TableSkeleton({ headers, columnWidths, rows = 6, rowClassName }: TableSkeletonProps) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full border-collapse">
        <thead className="bg-surface-variant">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
                  i === columnWidths.length - 1 || h === 'Valor' ? 'text-right' : 'text-left'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} className="border-t border-border">
              {columnWidths.map((w, ci) => {
                const isRight = ci === columnWidths.length - 1 || headers[ci] === 'Valor';
                return (
                  <td key={ci} className={cn(rowClassName ?? 'py-3 px-4', isRight && 'text-right')}>
                    {Array.isArray(w) ? (
                      <div className="flex flex-col gap-1.5">
                        <Shimmer w={w[0]} h={11} />
                        <Shimmer w={w[1]} h={9} />
                      </div>
                    ) : (
                      <Shimmer w={w} h={11} inline={isRight} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Shimmer({ w, h, inline }: { w: number; h: number; inline?: boolean }) {
  return (
    <span
      className={cn(
        inline ? 'inline-block' : 'block',
        'animate-shimmer rounded-[4px]'
      )}
      style={{
        width: w,
        height: h,
        background:
          'linear-gradient(90deg, var(--surface-container) 0%, var(--surface-container-low) 50%, var(--surface-container) 100%)',
        backgroundSize: '400px 100%',
      }}
    />
  );
}
```

Adicione ao `tailwind.config.ts` (ou globals.css `@theme inline`) o keyframe:

```css
@keyframes shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position:  200px 0; }
}
.animate-shimmer { animation: shimmer 1.2s linear infinite; }
```

```tsx
/* ------------------ ErrorState ------------------ */

export function ErrorState({
  title = 'Não foi possível carregar os dados',
  body = 'Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry: () => void;
}) {
  return (
    <Card className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-100 text-red-900">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      <p className="mx-auto mt-1 mb-4 max-w-sm text-sm text-on-surface-variant leading-relaxed">{body}</p>
      <Button onClick={onRetry}>
        <ArrowLeftRight className="size-3.5" />
        Tentar novamente
      </Button>
    </Card>
  );
}
```

```tsx
/* ------------------ EmptyState ------------------ */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <div className="mx-auto mb-3.5 grid size-14 place-items-center rounded-[14px] bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
      <p className="mx-auto mt-1 mb-4 max-w-md text-sm text-on-surface-variant leading-relaxed">{body}</p>
      {action}
    </Card>
  );
}
```

```tsx
/* ------------------ Spinner ------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white',
        className
      )}
    />
  );
}
```

```tsx
/* ------------------ Toast helper ------------------ */
// Wrap whatever your repo already uses (sonner / react-hot-toast).
// If nothing exists, the snippet below uses a small custom <ToastProvider>.
// Either way, export these three functions so calling code stays simple:

export function showToast(kind: 'success' | 'error' | 'neutral', message: string) {
  // delegate to your toast lib of choice
}
```

> **Sobre Toast:** confirme se o repo já tem uma lib (sonner é o que shadcn recomenda). Se sim, use ela e descarte o snippet acima. Se não, instale `sonner` e mantenha o helper `showToast(kind, message)` exportado daqui.

---

## Convenções de uso

```tsx
// Em ReceivablesClient.tsx (ou outro):
import { TableSkeleton, ErrorState, EmptyState, Spinner, showToast } from '@/components/financial/shared';
import { StatusBadge } from '@/components/ui/status-badge';
```

Não importe os helpers diretamente de cada feature — passa por `@/components/financial/shared` para manter a base coesa.
