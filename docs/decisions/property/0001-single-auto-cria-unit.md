# 0001 - SINGLE auto-cria Unit

**Status**: Accepted

## Context

A hierarquia de domínio é `Property → Unit → Lease`. Toda Unit precisa existir antes de um contrato de locação ser criado nela. Property do tipo `SINGLE` representa um imóvel de unidade única (uma casa, por exemplo) — ao contrário de `RESIDENTIAL`, que é um prédio com várias unidades gerenciadas separadamente.

## Decision

`CreateProperty` com `type=SINGLE` cria automaticamente, no mesmo fluxo do service, uma `Unit{Label: "Unidade 01", Notes: "Unidade criada automaticamente"}` vinculada. O usuário nunca precisa criar manualmente a única unidade de um imóvel SINGLE.

Alternativa considerada: exigir que o usuário crie a Unit manualmente após criar a Property, igual ao fluxo de `RESIDENTIAL`. Rejeitada — para `SINGLE` a existência de exatamente uma unidade é inerente ao tipo, forçar um passo manual extra seria fricção sem benefício (não há ambiguidade sobre quantas unidades deveria ter).

## Consequences

- `CreateProperty(SINGLE)` é uma operação que afeta duas tabelas (`properties` e `units`) atomicamente no service — precisa de transação ou tratamento de falha parcial coerente
- Remover uma Property `SINGLE` via soft-delete não cascba automaticamente pra Unit — cada entidade mantém seu próprio `is_active`
- Testes de `CreateProperty` para `SINGLE` precisam sempre assertar a criação implícita da Unit, não só da Property
