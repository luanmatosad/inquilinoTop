# 0001 - Payment imutável (sem Delete)

**Status**: Accepted

## Context

`Payment` registra cobranças reais de aluguel/depósito/despesa, muitas vezes já com cobrança gerada no provider externo (PIX/Boleto) e possivelmente já paga. Diferente de `Property`/`Unit`/`Lease`, que seguem o padrão geral de soft-delete (`domain-model.md`), um pagamento representa um fato financeiro que já ocorreu ou está em curso.

## Decision

`Payment` não tem operação de `Delete` — nem hard-delete, nem soft-delete. Uma vez criado, só pode ser atualizado (`PUT /api/v1/payments/{id}`), nunca removido.

## Consequences

- Correção de um pagamento errado é sempre via `Update`, nunca via "deletar e recriar" — isso preserva o histórico de auditoria e evita perder o vínculo com cobranças já emitidas no provider externo
- Pagamentos gerados incorretamente (ex: duplicados por bug) ficam no banco permanentemente — precisam de um status que os marque como inválidos se necessário, não há mecanismo de remoção
- `GenerateMonth` depende disso ser idempotente via constraint `(lease_id, competency, type)` (migration 000014) — a ausência de Delete reforça a necessidade de idempotência na criação, já que não há como "desfazer" uma geração incorreta
