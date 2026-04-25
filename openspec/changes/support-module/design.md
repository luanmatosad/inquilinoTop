## Context

Frontend já tem UI de suporte com:
- `/support` - Central com categorias (financeiro, contratos, app, outros)
- `/support/new-ticket` - Form de criar ticket (tipo, assunto, descrição)
- `/support/contacts` - Contatos

Frontend usa Supabase (não migraou para Go ainda). Backend segue padrão 4-domínios (model.go, repository.go, service.go, handler.go) com JWT RS256.

## Goals / Non-Goals

**Goals:**
- Criar tabela `support_tickets` no banco
- Implementar CRUD de tickets no backend Go
- Conectar frontend com backend via server actions
- Adicionar listagem de tickets do usuário

**Non-Goals:**
- Chat/mensagens dentro do ticket (escopo mínimo para MVP)
- Respostas do suporte (apenas visualização)
- Migração de auth para Go (continua Supabase)

## Decisions

1. **Database**: Criar tabela `support_tickets` com campos: id, user_id, tipo, assunto, descricao, status, created_at, updated_at

2. **Backend Pattern**: Seguir 4-padrão (model/repository/service/handler). Handler expõe REST API.

3. **Frontend Persistence**: Usar Supabase diretamente (como demais domínios não-migrados) - mesmo pattern de actions.ts

4. **Status do Ticket**: open → in_progress → resolved → closed

## Risks / Trade-offs

- **Risk**: Usuário não logado tenta criar ticket → Mitigation: Middleware protege /support/new-ticket
- **Risk**: Muitos tickets → Implementar paginação futura se necessário