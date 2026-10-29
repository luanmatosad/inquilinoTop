# 0001 - Separação ListPending / ListByOwner

**Status**: Accepted

## Context

O domínio `notification` tem duas necessidades de leitura bem diferentes: um worker interno que processa todas as notificações pendentes de qualquer owner (pra enviar email/SMS/push), e a API pública que só deve devolver notificações do owner autenticado. Uma versão anterior tinha uma vulnerabilidade de cross-owner leak corrigida no fix `c45e1d08` — uma query sem filtro de owner acabava exposta num caminho que deveria ser isolado por tenant.

## Decision

Duas queries de repositório deliberadamente separadas: `ListPending(limit)` sem filtro de `owner_id` (uso exclusivo do worker de envio, nunca exposta via handler HTTP) e `ListByOwner(ownerID, status)` com filtro de `owner_id` (única usada pela API pública `GET /api/v1/notifications`).

## Consequences

- A separação de nomes/assinaturas é a defesa principal contra reintroduzir o bug: `ListPending` não tem `ownerID` no assinatura, então é impossível chamá-la "por acidente" com os parâmetros da API pública
- Qualquer novo endpoint público neste domínio DEVE usar `ListByOwner` ou equivalente filtrado — nunca `ListPending` diretamente
- O worker de envio continua precisando iterar todos os owners — isso é intencional (processamento em lote), não um vazamento
