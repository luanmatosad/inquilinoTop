# 0001 - Laudo único por tipo, imutável após concluído, com fotos em tabela própria

**Status**: Accepted

## Context

O laudo de vistoria é a principal prova em disputas de caução e danos: registra o estado do imóvel na entrada e na saída do inquilino. Para servir de prova, o registro não pode mudar depois de fechado nem ser ambíguo sobre qual é "o" laudo de cada momento. As fotos dos itens precisam ser visíveis para toda a equipe da organização.

O módulo `document` não servia para as fotos: escopa por `owner_id` (usuário, então colegas não veriam as fotos), só aceita PDF/Word, não confere se a entidade existe e apaga com `DELETE` físico (contra o ADR [cross-cutting 0001](../_cross-cutting/0001-soft-delete-obrigatorio.md)).

## Decision

1. **Um laudo ativo por tipo e por contrato**: índice único parcial `(lease_id, type) WHERE is_active`. Um contrato tem no máximo uma entrada e uma saída ativas; corrigir um laudo errado é excluí-lo (soft-delete) e criar outro.
2. **Imutável após concluído**: `DRAFT` aceita edição de dados, itens e fotos; `COMPLETED` é somente leitura e qualquer escrita devolve 409 `INSPECTION_NOT_EDITABLE`. Concluir exige ao menos um item e é auditado. Não existe reabertura.
3. **Fotos em `inspection_photos`**, escopadas pela organização via item → laudo, com soft-delete. Só a interface de armazenamento de arquivos do `document` é reaproveitada, com pasta por organização. Aceita JPEG, PNG e WebP (tipo conferido pelos primeiros bytes do arquivo, não pelo cabeçalho enviado), até 10 MB e 10 por item. A leitura passa por endpoint autenticado.
4. **Permissões**: reaproveita `lease:read` e `lease:write`, já que o laudo pertence ao contrato.

Alternativas rejeitadas: reformar o `document` para organização/soft-delete (mexe em fluxos fora do escopo); guardar o laudo dentro de `lease` (um contrato tem vários laudos e ciclos de vida distintos); permitir reabrir laudo concluído (enfraquece o valor de prova).

## Consequences

- A unicidade vale também sob concorrência (índice no banco) e o limite de 10 fotos por item é aplicado dentro de uma transação com o item travado.
- Os arquivos de fotos removidas continuam no disco (a remoção é lógica); limpeza física fica para uma rotina futura.
- Uma permissão própria de laudo (por exemplo, só leitura para o inquilino) exigirá novos `Permission*` no `rbac`.
- O módulo `document` segue com seus defeitos; corrigi-lo é outra change.
