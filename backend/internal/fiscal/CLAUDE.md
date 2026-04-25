# fiscal — Núcleo Fiscal Transversal

Agregação do relatório fiscal anual + tabela IRRF versionada.

## Estrutura

- `IRRFTable` (interface) — consumida pelo `payment.Service` no MarkPaid.
- `BracketsRepository` (pg) — lê `irrf_brackets` com filtro `valid_from`.
- `AggregateRepository` (pg) — agrega payments, tax expenses e leases do owner.
- `AnnualReport` — resposta agregada por Lease: categoria (PJ_WITHHELD|CARNE_LEAO),
  total recebido, IRRF retido, IPTU dedutível.

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/fiscal/annual-report?year=YYYY | AnnualReport |

## Gotchas

- Somente payments `type=RENT` entram no total do relatório (EXPENSE=repasse IPTU não é receita do locador).
- `irrf_brackets` é seed estática — atualização requer nova linha com `valid_from` posterior.
- `deductible_iptu_paid` usa `expenses(category=TAX)` por ano de `due_date` (aproximação — expenses não têm paid_date).