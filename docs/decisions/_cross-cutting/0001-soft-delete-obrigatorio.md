# 0001 - Soft-delete obrigatório em toda entidade

**Status**: Accepted

## Context

O sistema gerencia dados financeiros e contratuais (imóveis, contratos, pagamentos) onde a remoção definitiva de um registro pode destruir histórico necessário pra auditoria, disputas contratuais ou simplesmente desfazer um erro do usuário. `DELETE FROM` é irreversível por natureza.

## Decision

Toda deleção no sistema é feita via `is_active=false` + `updated_at=NOW()`, nunca `DELETE FROM`. Essa é uma invariante cross-cutting documentada em `.claude/rules/domain-model.md`, aplicada a `Property`, `Unit`, `Lease`, `Tenant` e demais entidades de domínio.

Exceções conhecidas e deliberadas: `Payment` ([payment/0001](../payment/0001-payment-imutavel-sem-delete.md)) não tem delete algum, nem soft; `AuditLog` ([audit/0001](../audit/0001-logs-imutaveis-sem-soft-delete.md)) idem — essas duas são mais estritas que a regra geral, não uma violação dela.

## Consequences

- Toda query de listagem precisa filtrar `is_active=true` explicitamente — esquecer o filtro expõe registros "deletados" como se estivessem ativos
- Índices únicos (ex: email de usuário) precisam considerar `is_active` na constraint, ou um registro soft-deletado bloqueia a reutilização do mesmo valor por outro registro novo
- Não há expurgo automático de dados antigos — isso seria uma decisão separada (retenção/LGPD), não implícita nesta
- Testes de "delete" sempre precisam assertar `is_active=false` + presença do registro no banco, nunca ausência (`NOT FOUND` depois de delete seria sintoma de hard-delete acidental)
