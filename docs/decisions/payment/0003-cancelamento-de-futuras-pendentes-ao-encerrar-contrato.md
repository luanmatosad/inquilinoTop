# 0003 - Cancelamento de cobranças futuras pendentes ao encerrar contrato

**Status**: Accepted

## Context

O [ADR 0001](./0001-payment-imutavel-sem-delete.md) proíbe remover um `Payment`. Ao encerrar um contrato, porém, as cobranças geradas antecipadamente (`PENDING`, vencimento no futuro) deixam de fazer sentido: continuariam aparecendo em contas a receber e no dashboard como valores a vencer de um contrato que não existe mais. Manter só o status não resolve, porque `payments.status` aceita apenas `PENDING`, `PAID` e `LATE`.

## Decision

Abrir uma exceção estreita ao ADR 0001: `payments.is_active` (migration 000038) e um único método de escrita, `Repository.DeactivateFuturePending`, usado só por `lease.End`.

- Atinge apenas cobranças `PENDING`, com `due_date` depois da data do encerramento e **sem `charge_id`**.
- Pagas, vencidas e qualquer cobrança já emitida no provedor continuam intactas. As emitidas são contadas em `needs_review` e devolvidas na resposta para decisão manual.
- Consultas de leitura (`GetByID`, `ListByLease`, `ListByOwner`, dashboard, relatório fiscal) filtram `is_active=true`. `GetByChargeID` e a checagem de idempotência de `CreateIfAbsent` não filtram, para webhooks e a constraint `(lease_id, competency, type)` seguirem consistentes.
- `Update` e `Delete` de `Payment` continuam como antes: não existe `Delete` na API.

Alternativa rejeitada: manter as pendentes futuras e só parar de gerar novas. Polui contas a receber e o dashboard.

## Consequences

- O ADR 0001 vale para todo uso exceto este; qualquer nova desativação de cobrança exige novo ADR.
- Cobranças desativadas permanecem no banco (auditáveis) e ocupam a chave `(lease_id, competency, type)`, então a mesma competência não pode ser gerada de novo para esse contrato. Como o contrato encerrado não gera mais cobranças, isso é aceito.
- O cancelamento acontece depois do encerramento, sem transação conjunta: se falhar, o contrato fica `ENDED` e a resposta traz `payments_error` para o usuário agir.
