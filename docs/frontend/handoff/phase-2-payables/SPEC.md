# Spec — Phase 2: `/financial/payables`

Source of truth: `../../Contas a pagar.html` (abrir em browser, painel Tweaks).

---

## 1. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ H1 "Contas a pagar"            [Mai 2026] [+ Nova despesa]   │  ← header
│ caption "Despesas, impostos e pagamentos a fornecedores."    │
├─────────────────────────────────────────────────────────────┤
│ [Pago] [Agendado] [A pagar] [Em atraso]                       │  ← 4 cards
├─────────────────────────────────────────────────────────────┤
│ Fornecedores (7) │ Impostos & taxas (4)                       │  ← tabs
├─────────────────────────────────────────────────────────────┤
│ [🔍 Buscar...] [Status: Todos ▼] [⬇ Exportar]                │  ← toolbar
├─────────────────────────────────────────────────────────────┤
│ Tabela                                                       │
│ Vencimento · Beneficiário/Imóvel · Categoria · Valor · ...   │
└─────────────────────────────────────────────────────────────┘
```

Layout: `<main className="space-y-5 px-8 py-6 pb-16">`.

---

## 2. Data model

```ts
type PayableStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'SCHEDULED';
type PayableTab    = 'VENDOR' | 'TAX';
type PaymentMethod = 'PIX' | 'Boleto' | 'Cartão' | 'TED';

interface Payable {
  id: string;
  due: string;            // ISO yyyy-mm-dd
  supplier: string;       // razão social ou nome (free-text)
  property: string;       // label legível
  propertyId?: string;
  category: string;       // label legível
  amount: number;         // sempre POSITIVO. Sinal é decisão de apresentação.
  method: PaymentMethod;
  status: PayableStatus;
  reference: string;      // yyyy-mm
  tab: PayableTab;
  invoice: string;        // NFS-e, NF, Guia DARF, etc. (free-text)
  description?: string;
  reimburseToOwner: boolean;
  scheduledFor?: string;  // ISO date quando status=SCHEDULED
}
```

---

## 3. Header

| Element     | Value                                                           |
|-------------|-----------------------------------------------------------------|
| H1          | `Contas a pagar` — 24/700, `tracking-tight`                     |
| Caption     | `Despesas, impostos e pagamentos a fornecedores.` — 13/400      |
| Month btn   | shadcn `<Button variant="outline" size="sm">` + `Calendar` icon, label = `MMM yyyy` |
| Primary CTA | `<Button size="sm">` + `Plus` icon, label `Nova despesa`        |

---

## 4. Summary cards (4-up)

Grid `grid-cols-4 gap-3` (desktop ≥1024px), `grid-cols-2` em md, `grid-cols-1` em sm.

```
┌────────────────────────┐
│ [icon-bg]  Pago no mês │
│            R$ 1.030,00 │   <- 20/700, tabular-nums, color por tone
│            Saídas confirmadas. │  <- caption 11.5/400
└────────────────────────┘
```

Card props:

| Card        | Tone     | Icon       | Label          | Caption                             |
|-------------|----------|------------|----------------|-------------------------------------|
| Pago no mês | success  | `Check`    | "Pago no mês"  | Saídas confirmadas.                 |
| Agendado    | info     | `Calendar` | "Agendado"     | Aguardando data de débito.          |
| A pagar     | warning  | `ArrowUp`  | "A pagar"      | Dentro do prazo de pagamento.       |
| Em atraso   | error    | `AlertTriangle` | "Em atraso" | Risco de multa/juros.            |

Paleta por tone:

| Tone    | bg pill   | fg icon   | strong (valor) |
|---------|-----------|-----------|----------------|
| success | `#d1fadf` | `#15803d` | `var(--color-success-700)` |
| info    | `#dbe7ff` | `#00366f` | `#1e3a8a`                 |
| warning | `#fff0c2` | `#b45309` | `var(--color-warning-700)` |
| error   | `#fee2e2` | `#7f1010` | `var(--destructive)`       |

O sinal `−` no valor é controlado pelo toggle global (ver §11) — se ativo, todos os valores ganham prefixo `−` (U+2212, **não** hífen).

---

## 5. Tabs

```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="VENDOR">Fornecedores <Badge>{counts.VENDOR}</Badge></TabsTrigger>
    <TabsTrigger value="TAX">Impostos & taxas <Badge>{counts.TAX}</Badge></TabsTrigger>
  </TabsList>
</Tabs>
```

Badge no tab segue o pattern de Receivables: rounded-full, 22px min-width, 18px height, `text-[11px] font-semibold tabular-nums`.

Borda inferior do tab ativo: `border-b-2 border-primary`, color `text-primary`.

---

## 6. Tabela

7 colunas:

| Col | Label                | Conteúdo                                                                 |
|-----|----------------------|--------------------------------------------------------------------------|
| 1   | Vencimento           | `dd/mm/yyyy` em tabular-nums. Se OVERDUE: sub-linha `{N} dias em atraso` em `text-[11px] text-destructive`. |
| 2   | Beneficiário / Imóvel| supplier (13/600) + `property · invoice` em 12/400 `text-on-surface-variant`. Invoice em `font-mono text-[11.5px]`. |
| 3   | Categoria            | label 13/400 `text-on-surface-variant`                                   |
| 4   | Valor                | `(showOutflowSign ? '−' : '')fmtBRL(amount)`, 13/600 tabular-nums, color `text-destructive` se showOutflowSign else `text-on-surface`. Align right. |
| 5   | Forma                | `<MethodChip>` — pill 6px-radius, padding `2px 8px`. PIX usa `bg-primary/8 text-primary letter-spacing-[.02em]`. Outros usam `bg-surface-container text-on-surface-variant`. |
| 6   | Status               | `<StatusBadge status={status} />`                                        |
| 7   | (actions)            | `<DropdownMenuTrigger>` com `MoreVertical` 16px. Conteúdo em §7.        |

Row hover: `bg-surface-container-low`. Transition 120ms. Cursor default (linha não é clicável; ação é o dropdown).

OVERDUE row: badge muda (sempre) + opcionalmente fundo `bg-red-900/4` ou marca lateral de 3px à esquerda (ver §10).

Empty row (filtros sem match): `<td colSpan={7}>Nenhuma despesa encontrada com os filtros atuais.</td>`, padding `py-12`, centralizado, `text-on-surface-variant`.

---

## 7. Row dropdown menu

Ações condicionais por status:

### `OVERDUE`
- **Pagar agora (PIX)** — `<Send>`, primary tone (color `var(--primary)`)
- Notificar fornecedor — `<Mail>`

### `PENDING`
- Pagar agora (PIX) — `<Send>`
- **Agendar pagamento** — `<Calendar>`

### `SCHEDULED`
- Antecipar pagamento — `<Send>`
- **Cancelar agendamento** — `<X>`

### `PAID`
- Ver comprovante — `<FileText>`
- Baixar nota fiscal — `<Upload>`

### Sempre (em qualquer status, no fim)
- separador
- Editar despesa — `<FileText>`
- Excluir despesa — `<X>`, **danger tone** (color `var(--destructive)`, hover bg `rgba(186,26,26,.07)`)

Item style: `flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm font-medium`. Hover bg conforme tone.

Menu container: `min-w-[240px]`, `rounded-[10px]`, `border border-border`, `bg-card`, `shadow-md`, `p-1.5`. Animação `popIn .12s ease` (subtle scale).

---

## 8. Toolbar

`<Card className="p-3.5 flex justify-between items-center flex-wrap gap-3">`:

- Left: `<Input placeholder="Buscar por fornecedor, imóvel ou categoria…">` com ícone `Search`, min-width 280px, flex-basis 360px.
- Right (flex gap-2):
  - Label `Status` 12/500 `text-on-surface-variant`
  - shadcn `<Select>` ou `<select>` nativo com options: Todos · Agendado · Pendente · Atrasado · Pago. Min-width 140px.
  - `<Button variant="outline" size="sm"><Upload /> Exportar</Button>` (out of scope desta fase — botão estático).

Durante `loading | error | empty`, toolbar fica com `opacity-55 pointer-events-none`.

---

## 9. Estados (data / loading / error / empty)

Mesma estrutura de Receivables (Phase 1). Cuidados específicos:

- `loading.tsx` renderiza header + 4 cards de summary como skeleton + tabs como skeleton + `<TableSkeleton headers={['Vencimento','Beneficiário / Imóvel','Categoria','Valor','Forma','Status','']} columnWidths={[90, [160, 220], 90, 90, 50, 70, 20]} />`.
- `error`: copy `Não foi possível carregar as despesas`.
- `empty`:
  - aba `VENDOR`: title `Nenhuma despesa com fornecedor`, body `Quando você registrar uma OS, reparo ou serviço terceirizado, aparecerá aqui.`
  - aba `TAX`: title `Sem impostos ou taxas a pagar`, body `Cotas condominiais, IPTU e carnês importados aparecem nesta aba.`
  - CTA: `Nova despesa`
  - icon: `ArrowUp` (lucide)

---

## 10. Overdue treatment

Default: **sutil** (só o badge muda). Existem dois modos extras controlados por feature flag (`tweaks.overdueTreatment` no mock — em prod, transformar em config do usuário ou simplesmente fixar):

- `tonal` — row inteira recebe `bg-red-900/4` (rgba(186,26,26,.04))
- `marker` — coluna 1 ganha `border-l-[3px] border-destructive`

Para esta fase, ship com **sutil** fixo. Os outros modos ficam como ideia futura.

---

## 11. Toggle global "Mostrar sinal negativo nas saídas"

Persistido em localStorage com chave `inquilinotop.financial.showOutflowSign` (default `true`). UI do toggle: ainda não foi desenhado — para esta fase, **fixe `true` em código** (todos os valores em saídas com prefixo `−`) e abra issue separada para o toggle proper (provavelmente vira preferência global do usuário em `/settings/preferences`).

---

## 12. Modal "Nova despesa"

DialogTrigger no header (`+ Nova despesa`). Dialog `max-w-[720px]`, `<DialogTitle>Nova despesa</DialogTitle>`.

### 12.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Categoria ▼     │  Imóvel relacionado ▼                │
│  ─────────────────────────────────────                  │
│  Fornecedor / beneficiário                              │
│  ─────────────────────────────                          │
│  Vencimento │ Valor (R$) │ Forma ▼                       │
│  ─────────────────────────────                          │
│  Descrição (free-text, hint pequeno)                    │
│  ─────────────────────────────                          │
│  [toggle] Repassar custo ao proprietário                 │
│           Esta despesa será deduzida do próx. repasse.  │
└─────────────────────────────────────────────────────────┘
                                  + side: <ExpenseSidePreview/>
```

Grid: `grid grid-cols-[1fr_240px] gap-6`. À esquerda: form. À direita: preview card.

### 12.2 Campos

| Campo              | Tipo                       | Default  | Validação Zod                    |
|--------------------|----------------------------|----------|----------------------------------|
| `category`         | Select de EXPENSE_CATEGORIES| —        | enum, required                   |
| `propertyId`       | Select de PROPERTY_OPTIONS  | —        | UUID, required                   |
| `supplier`         | Input text                  | —        | length 1–80, required (mensagem `Informe o fornecedor.`) |
| `dueDate`          | Input `type=date`           | hoje     | ISO date, required               |
| `amount`           | Input text (currency mask)  | —        | number > 0 (mensagem `Valor deve ser maior que zero.`) |
| `method`           | Select PIX/Boleto/Cartão/TED| `PIX`    | enum                             |
| `description`      | Input text                  | —        | length 0–120 (opcional)          |
| `reimburseToOwner` | Toggle                      | `true`   | boolean                          |

Categorias (EXPENSE_CATEGORIES):

```
REPAIR_HYDRAULIC  Reparo hidráulico
REPAIR_ELECTRIC   Reparo elétrico
PAINT             Pintura
CLEAN             Limpeza
PEST              Dedetização
FURNITURE         Reparo de móveis
CONDO             Condomínio
IPTU              IPTU
TAX               Imposto / carnê-leão
OTHER             Outras despesas
```

A `tab` (`VENDOR` vs `TAX`) é **derivada** da categoria no servidor:
`CONDO | IPTU | TAX` → `TAX`; demais → `VENDOR`. Não é campo do form.

### 12.3 Toggle "Repassar custo ao proprietário"

Visual: pill toggle 32×18px (track) + 14×14 thumb. Bg track `var(--primary)` quando on, `var(--surface-container-high)` quando off. Thumb branco com `shadow-sm`.

Wrapper card (containing label + helper): `bg-surface-container-low border border-border rounded-lg p-2.5`. Click no card inteiro alterna.

Helper text quando ON: `Esta despesa será deduzida do próximo repasse mensal.`
Helper text quando OFF: `Esta despesa fica como custo operacional da imobiliária.`

### 12.4 Side preview

Card `bg-surface-container-low border border-border rounded-[10px] p-3.5`. Conteúdo:

```
RESUMO                                  ← 12/600 uppercase tracking-wide
─────────────────────────────────
[card branco]
  CATEGORY LABEL                        ← 11/500 uppercase
  Fornecedor                            ← 12.5/400
  Imóvel relacionado                    ← 12.5/400 muted
  ─────────────────────
  Vence 05/06/2026         −R$ 480,00   ← bottom row, valor em destructive 18/700
─────────────────────────────────
[se reimburse=true:]
  ↔ Repasse mensal será reduzido em R$ 480,00.
```

Box do "reimburse hint": `bg-primary/6 rounded-md px-2.5 py-2`, icon `ArrowLeftRight` 14px.

### 12.5 Footer

```
[Cancelar (outline)]   [Registrar despesa (primary)]
```

Botão registrar com icon `Check`. Spinner em submitting (Phase 1 pattern).

### 12.6 Estados do submit

Mesma estrutura da Phase 1 (`idle` / `validation` / `submitting` / `serverError`). Diferenças:

- Banner serverError: `O serviço financeiro retornou erro 500.`
- Toast success: `Despesa registrada com sucesso.`
- Toast error: `Falha ao registrar despesa. Tente novamente.`

---

## 13. Server Actions (esqueleto)

```ts
// frontend/src/app/financial/actions.ts (estende)
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const PayableCategory = z.enum([
  'REPAIR_HYDRAULIC','REPAIR_ELECTRIC','PAINT','CLEAN','PEST','FURNITURE',
  'CONDO','IPTU','TAX','OTHER',
]);

const CreateExpenseSchema = z.object({
  category:   PayableCategory,
  propertyId: z.string().uuid({ message: 'Selecione um imóvel.' }),
  supplier:   z.string().trim().min(1, 'Informe o fornecedor.').max(80),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  amount:     z.coerce.number().positive('Valor deve ser maior que zero.'),
  method:     z.enum(['PIX','Boleto','Cartão','TED']),
  description: z.string().max(120).optional(),
  reimburseToOwner: z.coerce.boolean(),
});

export async function getPayables(): Promise<Payable[]> { /* GO call */ }
export async function createExpense(_prev: unknown, fd: FormData): Promise<CreateExpenseResult> { /* validate + POST + revalidate */ }
export async function payPayable(id: string): Promise<{ ok: boolean }> { /* POST /pay */ }
export async function schedulePayable(id: string, date: string): Promise<{ ok: boolean }> { /* POST /schedule */ }
export async function cancelSchedule(id: string): Promise<{ ok: boolean }> { /* POST /cancel-schedule */ }
```

Tab derivado:

```ts
function tabFromCategory(c: PayableCategory): PayableTab {
  return c === 'CONDO' || c === 'IPTU' || c === 'TAX' ? 'TAX' : 'VENDOR';
}
```

---

## 14. StatusBadge — extensão

Add `SCHEDULED`:

```ts
SCHEDULED: { bg: '#dbe7ff', fg: '#00366f', dot: '#2563eb', label: 'Agendado' },
```

Não substitua nem renomeie `REVIEW` — coexistem com mesma cor mas labels distintos.

---

## 15. Sidebar — link ativo

No `Sidebar.tsx`, o item `Contas a pagar` (id `payables`, ícone `ArrowUp`) já existe mas pode estar sem `href`. Defina `href="/financial/payables"` e garanta que o estado `active` resolva via `usePathname()`.

---

## 16. Copy guidelines (especificas)

- Valores em saída: **prefixo `−`** (minus, U+2212), `text-destructive`. Nunca parênteses.
- "Beneficiário" em vez de "Pagador" no header da coluna — semântica de saída.
- "Despesa" em vez de "Cobrança" em toda a tela.
- "Fornecedor" para entes privados; "beneficiário" no form quando o pagamento pode ser para fornecedor OU para órgão público (impostos).

---

## 17. Acceptance checklist

- [ ] `/financial/payables` renderiza header, 4 cards de summary, 2 tabs com contadores, toolbar com busca + status + exportar, tabela com 7 colunas.
- [ ] `StatusBadge` aceita `SCHEDULED` e mostra o pill azul "Agendado".
- [ ] Sidebar destaca "Contas a pagar" como ativo nesta rota.
- [ ] Tab `VENDOR` mostra fornecedores; tab `TAX` mostra impostos/condomínio/carnês.
- [ ] Filtro Status filtra pelas 4 opções (mais "Todos").
- [ ] Busca filtra por supplier, property, category — instant, client-side.
- [ ] Valores na tabela e cards têm prefixo `−` (visual). O valor em si fica positivo no DB.
- [ ] Dropdown por row mostra ações certas para cada status (ver §7). Separador antes de "Excluir despesa".
- [ ] "Excluir despesa" tem tone danger (cor + hover); "Pagar agora" em OVERDUE tem tone primary.
- [ ] `loading.tsx` mostra skeleton matching a estrutura de 7 colunas.
- [ ] `ErrorState` aparece se as actions falharem; "Tentar novamente" chama `router.refresh()`.
- [ ] `EmptyState` aparece se a lista é realmente vazia (não confundir com filtros que zeram). Copy específica por aba. CTA `Nova despesa`.
- [ ] Modal "Nova despesa": form com 7 campos + toggle reimburse; validação Zod inline; submitting com spinner; serverError com banner + toast.
- [ ] Toggle "Repassar custo ao proprietário": helper text muda conforme estado. Default ON.
- [ ] Side preview do modal atualiza em tempo real conforme o user digita.
- [ ] `pnpm typecheck` e `pnpm lint` passam sem warnings.
- [ ] Nenhum valor com hífen (`-`) em vez de minus (`−`).
