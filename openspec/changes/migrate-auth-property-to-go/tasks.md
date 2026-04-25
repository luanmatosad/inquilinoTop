# Tarefas — Migrar Auth + Property para Go

## Fase 1: Camada Go Client

- [x] 1.1 Criar `src/lib/go/client.ts` — fetch wrapper com JWT
- [x] 1.2 Criar `src/lib/go/middleware.ts` — validação JWT
- [x] 1.3 Adicionar `NEXT_PUBLIC_API_URL` no `.env`

## Fase 2: Auth (Supabase → Go)

- [x] 2.1 Modificar `src/app/auth/actions.ts` — login → POST `/api/v1/auth/login`
- [x] 2.2 Modificar `src/app/auth/actions.ts` — signup → POST `/api/v1/auth/register`
- [x] 2.3 Modificar `src/app/auth/actions.ts` — logout → POST `/api/v1/auth/logout`
- [x] 2.4 Modificar `src/middleware.ts` — usar Go JWT validation
- [x] 2.5 Testar login/logout completo

## Fase 3: Property + Unit (Supabase → Go)

- [x] 3.1 Modificar `src/app/properties/actions.ts` — todas as actions → Go API
- [x] 3.2 Modificar `src/app/properties/page.tsx` — list → GET `/api/v1/properties`
- [x] 3.3 Modificar `src/app/properties/[id]/page.tsx` — detail → Go API
- [x] 3.4 Testar CRUD property completo

## Fase 4: Tenant (Supabase → Go)

- [x] 4.1 Modificar `src/app/tenants/actions.ts` → Go API
- [x] 4.2 Modificar `src/app/tenants/page.tsx` → Go API

## Fase 5: Lease (Supabase → Go)

- [x] 5.1 Modificar `src/app/leases/actions.ts` → Go API

## Fase 6: Payment (Supabase → Go)

- [x] 6.1 Modificar `src/app/payments/actions.ts` → Go API

## Fase 7: Expense (Supabase → Go)

- [x] 7.1 Modificar `src/app/expenses/actions.ts` → Go API

## Fase 8: Dashboard (Supabase → Go)

- [x] 8.1 Modificar `src/data/dashboard/dal.ts` → múltiplas rotas Go

## Fase 9: Limpeza

- [x] 9.1 Remover `src/lib/supabase/*` (após tudo funcionar)
- [x] 9.2 Remover variáveis Supabase do `.env` (opcional)

---

## Notas

- Testar cada fase antes de seguir para próxima
- Se algo quebrar, roll back é Simples: reverter arquivo
- Backend Go não precisa de mudança — já está pronto