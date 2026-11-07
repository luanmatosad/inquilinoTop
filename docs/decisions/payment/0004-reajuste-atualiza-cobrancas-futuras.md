# 0004 - Reajuste atualiza as cobranças futuras pendentes

**Status**: Accepted

## Context

Ao criar um contrato com `generate_payments`, o sistema gera até 12 cobranças de aluguel de uma vez, todas com `gross_amount` igual ao aluguel da época. Reajustar o aluguel (`POST /leases/{id}/readjust`) só mudava o contrato e o histórico: as cobranças já geradas continuavam no valor antigo, e o canvas promete o contrário ("as cobranças a partir de fevereiro usam este valor"). Depois de um reajuste, os meses seguintes ficariam errados até alguém regenerar as cobranças. O ADR [payment-0001](./0001-payment-imutavel-sem-delete.md) proíbe remover cobranças, e o índice único `(lease_id, competency, type)` conta também linhas inativas, então "desativar e regenerar" é impossível.

## Decision

O reajuste passa a **atualizar no lugar** o `gross_amount` das cobranças que ainda não ocorreram. Uma cobrança é atualizada quando todas as condições valem: `type = 'RENT'`, `status = 'PENDING'`, `is_active = true`, `charge_id IS NULL` e `due_date >=` a data de vigência do reajuste (inclusive).

Ficam de fora e não mudam: cobranças pagas, de IPTU (`EXPENSE`), com vencimento anterior à vigência, retiradas da cobrança (`is_active = false`) e de outros contratos ou organizações. As pendentes que já têm cobrança emitida no provedor (`charge_id`) **não** são alteradas e são devolvidas em `payments_need_review`, igual ao encerramento ([payment-0003](./0003-cancelamento-de-futuras-pendentes-ao-encerrar-contrato.md)).

O reajuste do contrato e a atualização das cobranças são duas etapas. Se a segunda falhar, o reajuste do contrato **não** é desfeito: a resposta traz `payments_error` e o erro vai para o log. O mesmo caminho vale para o reajuste automático por índice (`/adjust`), cuja vigência é o mês de referência do índice.

Alternativas rejeitadas:
- **Desativar e regenerar:** o índice único impede recriar a mesma competência, e viola o espírito do `payment-0001`.
- **Manter as futuras no valor antigo e avisar:** deixa até 11 meses errados e depende de o usuário lembrar de corrigir.
- **Atualizar também as emitidas:** muda o valor de algo já enviado ao inquilino e ao provedor.

## Consequences

- É uma atualização de valor, não uma remoção: respeita o `payment-0001`, que só proíbe apagar.
- Quem ler cobranças pendentes deve contar com `gross_amount` mudar enquanto não houver cobrança emitida ou pagamento.
- IRRF e valor líquido só são calculados no pagamento, então não precisam ser recalculados aqui.
- Reajuste com vigência no passado atualiza também pendentes já vencidas a partir dessa data (a multa e os juros continuam calculados sobre o novo bruto). A tela avisa quando a vigência é anterior a hoje.
- O `UPDATE` não é transacional com o reajuste do contrato; a divergência possível (contrato reajustado, cobranças não) é sinalizada na resposta.
