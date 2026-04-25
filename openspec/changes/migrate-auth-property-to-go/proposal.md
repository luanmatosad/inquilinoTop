## Why

O sistema usa Supabase para auth e acesso a dados. Mas o backend Go já tem todas as APIs implementadas (identity, property, tenant, lease, payment, expense, fiscal) com testes passando. O frontend ainda chama Supabase diretamente, causando duplicação de lógica e dependência de infraestrutura externa.

## What Changes

- Criar camada Go Client no frontend (`lib/go/`) para chamar APIs Go
- Migrar auth do Supabase Auth para Go Identity API
- Migrar property do Supabase para Go API (domain por domínio)
- Migrar dashboard que ainda usa Supabase
- Remover dependência gradual do Supabase

## Capabilities

### New Capabilities

- `go-api-client`: Camada HTTP no frontend para chamar Go API com JWT
- `go-auth`: Auth completo via Go (login, signup, logout, session)
- `go-property`: Property/Unit via Go API
- `go-tenant`: Tenant via Go API
- `go-lease`: Lease via Go API
- `go-payment`: Payment via Go API
- `go-expense`: Expense via Go API
- `go-dashboard`: Dashboard metrics via Go API

### Modified Capabilities

- Nenhum requisito existente muda — tudo continua funcionando igual

## Impact

- **Frontend**: `src/lib/go/`, `src/app/auth/actions.ts`, `src/app/*/actions.ts`, `src/data/dashboard/dal.ts`
- **Backend**: Já está pronto — nenhuma mudança
- **Dependências**: Supabase removido gradualmente