# Phase 5 — `/financial/commissions` (tela nova)

**Status:** ⏳ Em design — não pronto pra dev
**Branch sugerida:** `feat/commissions` (quando design fechar)

## O que é

**Comissões de corretores**: registro e pagamento de comissões geradas em operações de locação (corretagem) e venda. A tela centraliza cálculo, aprovação e pagamento.

## Por que não está pronto

Faltam decisões de regra de negócio:

### Bloqueios

1. **Regra de cálculo** — % fixo por corretor? Por tipo de operação (locação vs. venda)? Por imóvel? Mix? Em alguns mercados, a comissão de locação é fixa em "1 mês de aluguel"; em outros, é % do valor anual.
2. **Divisão** — quando há captador (quem trouxe o imóvel) + locador (quem fechou a locação), a comissão é dividida. Como? 50/50 fixo, configurável por corretor, ou negociado por contrato?
3. **Retenção fiscal** — comissão é renda do corretor. Aplica IRRF? Se sim, na fonte (a imobiliária retém) ou repassa bruto e o corretor declara? Mudanças por regime tributário do corretor (MEI vs. CLT vs. autônomo).
4. **Vinculação com Repasses** — uma comissão é uma **despesa** (vai pra Payables) ou um **repasse** (vai pra Transfers)? Provavelmente Payables com categoria `COMMISSION`, mas a aprovação e o ciclo de aprovação podem justificar tela própria.
5. **Aprovação** — gestor aprova comissão a comissão? Em lote por corretor? Automaticamente quando o aluguel é confirmado?

## Hipótese 1: tela própria (recomendada)

```
┌─────────────────────────────────────────────────────────────┐
│ H1 "Comissões"                            [+ Nova comissão] │
├─────────────────────────────────────────────────────────────┤
│ Resumo: A pagar R$ 12.400 · Pagas no mês R$ 8.200 · Aprovadas R$ 4.100 │
├─────────────────────────────────────────────────────────────┤
│ Tabs: Locação · Venda · Captação                            │
├─────────────────────────────────────────────────────────────┤
│ Filtros: Corretor ▼  Status ▼  Período                       │
├─────────────────────────────────────────────────────────────┤
│ Tabela: Corretor · Imóvel · Operação · Base · % · Líquido · Status │
└─────────────────────────────────────────────────────────────┘
```

Ações por linha:
- `PENDING` → Aprovar · Editar % · Recusar
- `APPROVED` → Pagar agora · Editar
- `PAID` → Ver comprovante · Estornar

Modal "Nova comissão": Operação (Locação/Venda) → Corretor → Imóvel → Base (auto-preenchida do contrato) → % → Líquido (auto). Override manual permitido.

## Hipótese 2: virar filtro de Payables

Comissão = `Payable` com `category='COMMISSION'`. A tela Payables ganha um filtro extra e basta. Mais simples mas perde:
- Cálculo automático a partir do contrato
- Regra de % por corretor
- Visão consolidada "quanto cada corretor tá ganhando"

**Decisão recomendada:** Hipótese 1. Comissões têm fluxo próprio o suficiente pra justificar tela.

## Backend (Go) — necessário antes

- Configuração de corretores (já existe? Ou parte da feature de equipe?)
- Tabela `commissions` com colunas: id, brokerId, leaseId/saleId, base, percent, gross, withholding, net, status, paidAt
- Trigger automático: quando uma locação é confirmada e há `brokerId` no contrato, cria comissão `PENDING`
- Endpoints: list, approve, pay (que internamente cria Payable se Hipótese 2)

## Pré-requisitos antes do handoff

Igual à Phase 4 — sessão de discovery comigo + você (e idealmente o gestor responsável por comissões na imobiliária real) pra fechar:

1. Como calcular (% por quê?)
2. Como dividir entre múltiplos corretores
3. Como tratar fiscal
4. Aprovação um-a-um ou em lote
5. Decidir Hipótese 1 ou 2

Depois eu produzo mock + SPEC.

---

**Próximo passo do design:** depois que Phase 4 estiver clara, podemos sentar 30–45min nessa. Comissões tem mais variação por mercado (residencial vs. comercial vs. venda) — se o seu cliente atende mais de um, vale modelar configurável desde v1.
