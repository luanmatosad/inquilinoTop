# 0002 - COMMERCIAL como tipo multiunidade

**Status**: Accepted

## Context

O redesign (canvas "ImoviFlow — Telas") distingue três tipos de imóvel: Casa, Residencial e Comercial. O domínio só tinha `RESIDENTIAL` e `SINGLE`, com um `CHECK` no banco (`properties_type_check`). Um ponto comercial (galeria, sala em centro empresarial) tem várias unidades, cada uma com seu próprio contrato, igual a um prédio residencial. Isso importa para os Relatórios e o Carnê-leão, que classificam a receita por tipo de imóvel.

## Decision

Adicionar `COMMERCIAL` como terceiro valor de `properties.type` (migration `000046`). Ele se comporta como `RESIDENTIAL`: multiunidade, sem unidade automática. Só `SINGLE` cria "Unidade 01" (ver [0001](./0001-single-auto-cria-unit.md)).

A mesma migration acrescenta `number` e `complement` (opcionais) ao endereço, porque o canvas separa logradouro, número e complemento.

Alternativas rejeitadas:
- **Tratar Comercial como `RESIDENTIAL`** com outro rótulo: esconde o dado, e Relatórios e Carnê-leão não conseguiriam separar a receita depois sem um backfill ambíguo.
- **Retirar Comercial do canvas:** o produto atende pontos comerciais.
- **Concatenar número e complemento em `address_line`:** obriga a quebrar o texto na edição e perde dado.

## Consequences

- A migration `down` falha de propósito se existir algum imóvel `COMMERCIAL`: não apagamos nem convertemos dado em silêncio.
- Todo consumidor que decide por tipo precisa tratar `COMMERCIAL`; hoje só o service de `property` decide (validação e unidade automática do `SINGLE`).
- O tipo "Terreno" que aparece no canvas mobile não existe no domínio e não foi adicionado.
