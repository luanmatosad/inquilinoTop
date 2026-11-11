# Design

## Context

O change `2026-04-23-security-and-feature-enhancements` foi arquivado com itens abertos. Código atual relevante: `MaxRetries = 5` em `internal/notification` (retry termina em `failed`); `ReserveAndSend` com `FOR UPDATE SKIP LOCKED`; tabela `index_values` criada; cálculo de correção existe, mas sem fonte de índice nem aviso automático; `audit_logs` cobre login/logout, não mutações.

## Goals / Non-Goals

**Goals:**
- Fechar os 20 itens abertos ou declará-los fora de escopo com motivo.
- Fonte de índice rastreável e atualização anual automática.
- Templates de e-mail sem alterar o fluxo de envio existente.

**Non-Goals:**
- Reescrever notificações ou RBAC.
- Frontend para índices e 2FA neste change.
- Graceful shutdown e rate limiting: já implementados, fora deste change.

## Decisions

- **Fonte de índices (em aberto):** IPCA via API do IBGE SIDRA; IGP-M via API da FGV ou do BCB. Nova dependência externa, então vira ADR em `docs/decisions/` antes de implementar. Alternativa: entrada manual de índices pelo owner, sem dependência externa; mais simples, sem scheduler.
- **Aviso 30 dias (em aberto):** scheduler diário gera notificação ao owner 30 dias antes da data de reajuste do contrato. Confirmação continua manual (`confirmar` já existe).
- **Retry (em aberto):** manter `MaxRetries = 5` (estado atual) e corrigir a spec, ou reduzir para 3. Recomendação: manter 5, pois já está em produção e reduzir aumenta falha definitiva.
- **Templates:** `text/template` do Go, arquivos versionados no pacote `notification`. Sem engine externa.
- **Versionamento:** `/api/v2/` monta o mesmo handler de domínio; `/api/v1/` permanece sem alteração de contrato. Header `X-API-Version` nas respostas de ambos.
- **Auditoria de mutações:** middleware chi em rotas POST/PUT/PATCH/DELETE grava `audit_logs` após resposta 2xx.

## Risks / Trade-offs

- Dependência de API externa de índices: indisponibilidade atrasa reajuste. Mitigação: falha vira notificação, sem alterar valor do contrato.
- Middleware de auditoria grava também em rotas sensíveis: não gravar corpo com senha ou token.
- Escopo grande (20 itens): pode ser dividido em duas entregas, uma por fase, se a decisão de índice atrasar.
