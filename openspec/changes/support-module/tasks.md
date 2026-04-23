## 1. Backend - Suporte Module

- [x] 1.1 Criar migration tabela support_tickets (id, user_id, tipo, assunto, descricao, status, created_at, updated_at)
- [x] 1.2 Criar model.go em backend/internal/support/
- [x] 1.3 Criar repository.go (CRUD de tickets)
- [x] 1.4 Criar service.go
- [x] 1.5 Criar handler.go (REST endpoints)

## 2. Frontend - Server Actions

- [x] 2.1 Criar frontend/src/app/support/actions.ts com createTicket, getTickets, getTicketById
- [x] 2.2 Conectar form /support/new-ticket com server action (substituir useState local)
- [x] 2.3 Criar página /support/tickets com listagem
- [x] 2.4 Criar página /support/tickets/[id] com detalhes

## 3. Testes e Integração

- [x] 3.1 Testar criação de ticket via frontend
- [x] 3.2 Testar listagem de tickets
- [x] 3.3 Rodar lint/typecheck