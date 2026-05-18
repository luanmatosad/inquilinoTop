# Roadmap — Módulo financeiro

Cinco fases, três prontas pra dev, duas em design. Pode pegar em paralelo (sem dependências fortes entre 1, 2, 3).

---

## Fase 1 — `/financial/receivables` (refinamento)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/receivables-states`
**Estimativa:** 0.5–1 dia

A base de Contas a receber já foi mergeada (`feat/receivables-redesign`). Esta fase adiciona o que falta para a tela considerar-se completa em produção:

- 4 estados da tabela (`data` / `loading` / `error` / `empty`)
- 4 estados do modal Nova cobrança (`idle` / `validation` / `submitting` / `serverError`)
- Skeleton com shimmer matching a estrutura de colunas final
- Empty state com copy específica por aba (Aluguel vs. Outras cobranças)
- Error state com retry
- Banner de erro do server dentro do modal + toasts diferenciados (success / error / neutral)

Não toca em `ReceivablesClient.tsx` quanto à estrutura de tabs/filtros/colunas — só adiciona os estados ao redor e refatora o submit do `NewChargeModal` para os 4 estados de envio.

---

## Fase 2 — `/financial/payables` (tela nova)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/payables`
**Estimativa:** 2–3 dias

Tela nova completa. Espelha intencionalmente o esqueleto de Receivables (tabs + filtros + tabela + modal) para reduzir custo cognitivo do gestor que navega entre as duas. Diferenças semânticas:

- Abas **Fornecedores** / **Impostos & taxas**
- Status estendido: adiciona `SCHEDULED` (pagamento agendado) à paleta do `StatusBadge`
- Tabela com colunas Beneficiário · Categoria · Valor · Forma · Status
- 4 cards de resumo (Pago · Agendado · A pagar · Em atraso)
- Ações condicionais por status:
  - `OVERDUE` → Pagar agora (PIX) + Notificar fornecedor
  - `PENDING` → Pagar agora + Agendar pagamento
  - `SCHEDULED` → Antecipar + Cancelar agendamento
  - `PAID` → Ver comprovante + Baixar NF
- Modal "Nova despesa" (7 campos): Categoria · Imóvel · Fornecedor · Vencimento · Valor · Forma · Descrição + toggle "Repassar custo ao proprietário"
- Toggle global "Mostrar sinal negativo nas saídas" (default ligado)

Server Actions: `getPayables()`, `createExpense()`, `markPaid()`, `schedulePayment()`. Endpoints Go ainda não existem — a fase inclui as actions stubadas retornando seed para a UI funcionar enquanto o backend é construído em paralelo.

---

## Fase 3 — `/financial/transfers` (tela nova)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/transfers`
**Estimativa:** 2 dias

Repasses ao proprietário. Tela single-screen com:

- Header banner "Total líquido a repassar — {mês}" + ações Exportar CNAB e Ver histórico
- Tabela: Proprietário · Imóveis · Bruto · Taxa adm · Descontos · Líquido · Status
- Status: `PENDING` (Aguardando) · `APPROVED` (Aprovado) · `SENT` (Enviado)
- Por row: botão "Ver extrato" abre Modal com decomposição linha-a-linha
  - Aluguel recebido (+)
  - Taxa de administração (−)
  - IRRF (Carnê-leão) (−)
  - IPTU retido (−)
  - **Total a repassar**
- CTA primário no header: "Processar repasses do mês" → fluxo em wizard (out of scope desta fase — vira `feat/transfers-wizard` na iteração 2)

Mock base: `ui_kits/web/TransfersScreen.jsx`.

---

## Fase 4 — `/financial/reconciliation` (tela nova)

**Status:** ⏳ Em design
**Branch sugerida:** `feat/reconciliation` (quando design pronto)

Conciliação bancária. Fluxo previsto (a confirmar com você):

- Upload de extrato CNAB/OFX
- Lista de movimentações importadas com sugestão automática de match contra cobranças/despesas internas
- Ações por linha: Confirmar match · Reatribuir · Marcar como avulso · Ignorar
- Filtros por banco, conta, período
- Estados extras: itens não-conciliados em destaque, totais por banco

**Bloqueios:**
- Definir formato e parser de CNAB que o Go suporta
- Decidir se sugestão de match é regra ou ML (escopo de v1 é regra simples por valor + data ± 2 dias)

Não tem mock React ainda. Vou voltar a essa fase após você sinalizar prioridade.

---

## Fase 5 — `/financial/commissions` (tela nova)

**Status:** ⏳ Em design
**Branch sugerida:** `feat/commissions` (quando design pronto)

Comissões de corretores. Fluxo previsto (a confirmar):

- Lista de contratos com comissão devida (locação ou venda)
- Por linha: corretor · imóvel · base de cálculo · % · valor · status (Pendente · Aprovada · Paga)
- Regra de cálculo configurável por corretor / por tipo de operação
- Aprovação em massa + integração com Repasses (Phase 3) ou Payables (Phase 2) — TBD

**Bloqueios:**
- Definir regras de comissionamento (% sobre quê? Há retenção fiscal? Comissão dividida entre captador + locador?)
- Decidir se Commissions é um ledger próprio ou um filtro de Payables

Não tem mock React. Voltar após Phase 4 ou conforme prioridade.

---

## Ordem sugerida de execução

```
sprint 1 ──► Fase 1 (receivables-states)   [meio dia]
            Fase 2 (payables)              [paralelo, 2–3 dias]

sprint 2 ──► Fase 3 (transfers)            [2 dias]

sprint 3 ──► refinamento de design de Fase 4 + Fase 5

sprint 4 ──► Fase 4 (reconciliation)

sprint 5 ──► Fase 5 (commissions)
```

Pode pular Fase 1 e ir direto pra Fase 2/3 se preferir entregar tela nova antes de polir o que já tá no ar.

---

## Dependências cruzadas

| Item                                         | Quem usa            |
|----------------------------------------------|---------------------|
| `StatusBadge` + paleta com `SCHEDULED`       | 2, 3, 4             |
| `financial-shared.tsx` (Skeleton, Error, Toast) | 1, 2, 3, 4       |
| `fmtBRL` / `fmtDate` / `fmtMonth`            | todos               |
| `RowDropdownMenu` pattern                    | 2 (e provavelmente 4) |
| Padrão de 4 estados da tabela                | 1, 2, 3 (parcial), 4 |
| Padrão de 4 estados do modal                 | 1, 2, e provavelmente 4 |
