# Spec — Phase 1: estados de `/financial/receivables`

Source of truth: `../../Contas a receber.html` (abrir em browser, usar o painel Tweaks).

---

## 1. Estados da tabela (4)

A `ReceivablesClient.tsx` recebe os dados via prop `payments`. Após esta fase, ela passa a receber também um discriminador de estado:

```ts
type ReceivablesState =
  | { kind: 'data';    payments: Payment[]; leases: LeaseOption[] }
  | { kind: 'loading' }
  | { kind: 'error';   message?: string }
  | { kind: 'empty' };
```

A `page.tsx` decide o `kind` no Server Component:

```ts
// page.tsx (simplified)
const result = await Promise.allSettled([
  getReceivables(),
  getActiveLeases(),
]);

const payments = result[0].status === 'fulfilled' ? result[0].value : null;
const leases   = result[1].status === 'fulfilled' ? result[1].value : null;

const state: ReceivablesState =
  payments === null || leases === null
    ? { kind: 'error' }
    : payments.length === 0
      ? { kind: 'empty' }
      : { kind: 'data', payments, leases };

return <ReceivablesClient state={state} />;
```

> Server Component não emite `loading`. `loading.tsx` no App Router cobre isso — implemente um `loading.tsx` ao lado de `page.tsx` que renderiza o `TableSkeleton` (ver `1.2`). O `loading` no client é só usado em refetch após retry/erro.

### 1.1 — `data` (estado atual)

Sem mudanças. A tabela renderiza com tabs, filtro, busca, dropdown.

### 1.2 — `loading`

- Em `loading.tsx` (App Router): renderiza header + tabs como esqueleto + `<TableSkeleton headers=[…] columnWidths=[…] />`.
- Headers: `Vencimento` · `Pagador / Imóvel` · `Competência` · `Valor` · `Forma` · `Status` · `''`
- columnWidths: `[90, [160, 220], 60, 90, 50, 70, 20]` (o segundo é um par porque o pagador tem nome + property em duas linhas)
- 6 rows de skeleton com shimmer (definido em `_shared`).

### 1.3 — `error`

Substitui a tabela inteira pelo componente `<ErrorState>` (ver `_shared/README.md`). Header da página + tabs continuam visíveis no topo.

- Title: `Não foi possível carregar as cobranças`
- Body: `Houve um erro de comunicação com o serviço financeiro. Verifique sua conexão e tente novamente.`
- Botão: `Tentar novamente` → recarrega via `router.refresh()`.

### 1.4 — `empty`

Substitui a tabela pelo `<EmptyState>`. Copy varia por aba:

| Aba              | Title                              | Body                                                                          |
|------------------|------------------------------------|-------------------------------------------------------------------------------|
| `Aluguel`        | Sem aluguel pendente neste mês     | Quando você gerar a próxima fatura de aluguel, ela vai aparecer aqui.         |
| `Outras cobranças` | Nenhuma outra cobrança no momento | Reparos, multas e taxas extraordinárias aparecem aqui depois de gerados.      |

CTA primário do EmptyState: `Nova cobrança` (abre o modal).

Ícone do EmptyState: `Wallet` (lucide).

> Importante: `empty` é a lista **realmente vazia**. Se há rows mas o filtro / busca corrente não retorna nada, mantenha a mensagem inline atual (`Nenhuma cobrança encontrada com os filtros atuais.`) dentro do `<tbody>` — não substitua pela EmptyState global.

---

## 2. Estados do modal Nova cobrança (4)

`createPayment()` precisa retornar um discriminated result em vez de `void`:

```ts
// actions.ts
type CreatePaymentResult =
  | { ok: true }
  | { ok: false; kind: 'validation'; fieldErrors: Partial<Record<keyof CreatePaymentInput, string>> }
  | { ok: false; kind: 'server'; httpStatus: number };

export async function createPayment(_prev, formData): Promise<CreatePaymentResult> {
  const parsed = CreatePaymentSchema.safeParse(/* ... */);
  if (!parsed.success) {
    return { ok: false, kind: 'validation', fieldErrors: flattenZodErrors(parsed.error) };
  }
  try {
    const res = await goClient.post(`/api/v1/leases/${parsed.data.leaseId}/payments`, parsed.data);
    if (!res.ok) return { ok: false, kind: 'server', httpStatus: res.status };
    revalidatePath('/financial/receivables');
    return { ok: true };
  } catch {
    return { ok: false, kind: 'server', httpStatus: 0 };
  }
}
```

Mantenha `useActionState(createPayment, { ok: true })` no client. O return passa a alimentar:

### 2.1 — `idle`

Estado inicial. Botão `Gerar e enviar` ativo, campos limpos, sem banner.

### 2.2 — `validation`

Resposta `{ ok: false, kind: 'validation', fieldErrors }`.

- Para cada campo com erro, `<FormField error={fieldErrors[name]}>` — borda vermelha (`border-destructive`) e mensagem `text-[11px] text-destructive` por baixo.
- Hint do campo (quando existe) some quando há erro.
- Toast: **não** dispara em validation. O erro é local ao form.
- Botão `Gerar e enviar` reabilitado para o user corrigir e submeter novamente.

Mensagens (Zod schemas, pt-BR):

| Campo        | Regra                                          | Mensagem                                        |
|--------------|------------------------------------------------|-------------------------------------------------|
| `leaseId`    | UUID válido                                    | `Selecione um contrato.`                        |
| `type`       | enum                                           | `Tipo inválido.`                                |
| `reference`  | YYYY-MM                                        | `Competência inválida.`                         |
| `dueDate`    | ISO date, `>= reference` (mês ≥ competência)  | `Vencimento não pode ser anterior à competência.` |
| `amount`     | `> 0`                                          | `Valor deve ser maior que zero.`                |
| `description`| length 1–120                                   | `Descrição é obrigatória (até 120 caracteres).` |

### 2.3 — `submitting`

Enquanto `pending` do `useActionState` está `true`.

- Botão `Gerar e enviar` → `<Spinner /> Enviando…`, `disabled`.
- Botão `Cancelar` → `disabled`.
- Modal não fecha em click no backdrop nem em Esc (`onPointerDownOutside`/`onEscapeKeyDown` → `preventDefault()` quando `pending`).
- Campos ficam editáveis mas o user não pode submeter de novo (botão disabled).

### 2.4 — `serverError`

Resposta `{ ok: false, kind: 'server', httpStatus }`.

- Banner no topo do `DialogContent`, **acima** do grid de campos:

```
┌────────────────────────────────────────────────────────────┐
│ ⚠ Não foi possível gerar a cobrança.                       │
│   O serviço financeiro retornou erro 502. Tente novamente  │
│   em alguns instantes.                                     │
└────────────────────────────────────────────────────────────┘
```

- Background `#fee2e2`, border `rgba(186,26,26,.25)`, text `#7f1010`. Padding `10px 12px`, border-radius `8px`, margin-bottom `14px`.
- Ícone `AlertTriangle` lucide à esquerda, `httpStatus` em `font-mono`.
- Toast: dispara `showToast('error', 'Falha ao gerar cobrança. Tente novamente.')` em paralelo (caso o user feche o modal sem ver o banner).
- Botão `Gerar e enviar` volta a ficar enabled.

### 2.5 — sucesso

- Modal fecha (`setOpen(false)`).
- Toast `showToast('success', 'Cobrança gerada e enviada ao inquilino.')`.
- `revalidatePath` já foi chamado no server — Next refetcha a lista.

---

## 3. Toast — variantes

Hoje só usa `toast.success`. Estenda:

```ts
// frontend/src/lib/sonner.ts
import { toast as sonnerToast } from 'sonner';

export const showToast = {
  success: (msg: string) => sonnerToast.success(msg, { /* ... */ }),
  error:   (msg: string) => sonnerToast.error(msg,   { /* ... */ }),
  neutral: (msg: string) => sonnerToast(msg,          { /* ... */ }),
};
```

Visual:

| Variante | Border-left   | Icon                | Background        |
|----------|---------------|---------------------|-------------------|
| success  | `#22c55e`     | `Check` (`#15803d`) | `var(--card)`     |
| error    | `var(--destructive)` | `AlertTriangle` (`var(--destructive)`) | `var(--card)`     |
| neutral  | `var(--primary)` | `Bell` (`var(--primary)`) | `var(--card)`     |

Posição: `bottom-right`. Auto-dismiss: 3200ms. Ação `dismiss` (X) sempre visível.

Usos:

- **success** — cobrança gerada, lembrete enviado, recibo baixado
- **error**   — `createPayment` retornou serverError
- **neutral** — confirmação de ação que não é "sucesso definitivo" (ex.: cancelamento, abrir recibo em nova aba, copiar link)

---

## 4. Skeleton — detalhes visuais

Background do shimmer: gradient `surface-container → surface-container-low → surface-container`, `backgroundSize: 400px 100%`, animação `shimmer 1.2s linear infinite` deslocando o background.

```css
@keyframes shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position:  200px 0; }
}
```

- A coluna "Pagador / Imóvel" é a única com duas linhas de skeleton empilhadas (`160px` em cima + `220px` mais baixo, gap `6px`).
- Todas as outras células: uma linha só, altura `11px`, largura específica por coluna (ver `1.2`).
- Cell padding idêntico ao da row de produção (`py-3 px-4`).
- Sem checkbox / sem hover / sem dropdown trigger no skeleton.

---

## 5. Loading no botão `Gerar e enviar`

Spinner: círculo de 14×14 com `border-2`, `border-white/40`, `border-t-white`, `rounded-full`, `animate-spin` (0.7s). Texto muda para `Enviando…` (não `Carregando…`, não `Aguarde…`).

```tsx
<Button disabled={pending}>
  {pending ? (<><Spinner /> Enviando…</>) : (<><Send className="size-3.5" /> Gerar e enviar</>)}
</Button>
```

---

## 6. Acceptance checklist

- [ ] `loading.tsx` existe ao lado de `page.tsx` e renderiza `<TableSkeleton>` com a estrutura de 7 colunas correta.
- [ ] Quando `getReceivables()` ou `getActiveLeases()` falha, a tela mostra `<ErrorState>` com botão "Tentar novamente" que chama `router.refresh()`.
- [ ] Quando ambas Server Actions retornam sucesso mas `payments` está vazio, a tela mostra `<EmptyState>` com copy específica por aba e CTA `Nova cobrança`.
- [ ] Filtros que zeram a lista mostram a mensagem inline (`Nenhuma cobrança encontrada com os filtros atuais.`), **não** o `EmptyState` global.
- [ ] `createPayment` retorna `CreatePaymentResult` discriminado; `NewChargeModal` lida com `validation`, `submitting`, `serverError`.
- [ ] Validation: campos com erro têm borda vermelha + mensagem em pt-BR; hint some quando há erro.
- [ ] Submitting: botão Gerar com spinner + label `Enviando…`; Cancelar disabled; backdrop/Esc não fecham.
- [ ] ServerError: banner vermelho no topo do modal com status HTTP em font-mono; submit reabilita; toast `error` dispara em paralelo.
- [ ] `showToast.success/error/neutral` substitui o uso direto de `toast.success` em todo o módulo financeiro.
- [ ] `StatusBadge` continua sem novos statuses (`SCHEDULED` entra na Phase 2, não aqui).
- [ ] `pnpm typecheck` e `pnpm lint` passam sem warnings.
