## Why

O frontend já possui a interface de suporte (/support) com formulários para criação de tickets e listagem de categorias, mas não há Persistência de dados. Usuários conseguem abrir chamado mas ele não é salvo em lugar nenhum - o frontend usa apenas useState local. O módulo de suporte no backend inexiste, impossibilitando que usuários acompanhem e gerenciem seus tickets.

## What Changes

- Criar modelo, repositório, serviço e handler para `support` no Go backend
- Adicionar server actions no frontend para persistir tickets no Supabase
- Adicionar página de listagem de tickets do usuário (/support/tickets)
- Adicionar detalhamento de ticket (/support/tickets/[id])

## Capabilities

### New Capabilities
- `support-ticket`: Sistema de tickets de suporte com CRUD (criar, listar, visualizar). Cada ticket tem: tipo (duvida/sugestao/reclamacao/outro), assunto, descricao, status (open/in_progress/resolved/closed), data de criação, data de atualização.

### Modified Capabilities
(nenhum - módulo novo)

## Impact

- **Backend**: novo domínio `support` em `backend/internal/support/`
- **Frontend**: novo `frontend/src/app/support/actions.ts` + nova página `/support/tickets`
- **Database**: nova tabela `support_tickets` via migrations