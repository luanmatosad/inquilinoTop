# 0001 - Logs de auditoria imutáveis, sem soft-delete

**Status**: Accepted

## Context

`AuditLog` registra eventos de segurança (login, logout, falha de login, CRUD, permissão negada). A invariante geral do domínio (`domain-model.md`) é soft-delete obrigatório em toda entidade — mas um log de auditoria existe justamente para registrar o que aconteceu de forma confiável, inclusive eventos que envolvem tentativa de acesso indevido.

## Decision

`AuditLog` não segue a invariante geral de soft-delete. Não há operação de delete (nem soft, nem hard) — uma vez criado, um registro de auditoria permanece para sempre.

## Consequences

- `AuditLog` é uma exceção deliberada à regra geral de `domain-model.md` — qualquer revisão futura dessa invariante global precisa considerar esse caso explicitamente
- Não há mecanismo de expurgo/retenção configurável hoje — se isso for necessário (LGPD, custo de armazenamento), será uma decisão nova, não uma extensão natural desta
- `NoopAuditLogger` como default (quando auditoria não está configurada) significa que a ausência de configuração não quebra o fluxo de login/logout — mas também significa que é fácil esquecer de configurar um logger real em produção, sem erro visível
