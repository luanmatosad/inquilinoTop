# fiscal — Tabela IRRF versionada

Tabela IRRF versionada, consumida pelo cálculo de pagamentos.

## Estrutura

- `IRRFTable` (interface) — consumida pelo `payment.Service` no MarkPaid.
- `BracketsRepository` (pg) — lê `irrf_brackets` com filtro `valid_from`.

## Gotchas

- `irrf_brackets` é seed estática — atualização requer nova linha com `valid_from` posterior.
