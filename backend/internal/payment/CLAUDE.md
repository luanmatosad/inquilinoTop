# payment — Pagamentos

Vinculado a Lease. Sem Delete (pagamentos não são removidos). Listagem sempre por lease.

## Modelo

`Payment`: id, owner_id, lease_id, due_date, paid_date?, amount, status (PENDING|PAID|LATE), type (RENT|DEPOSIT|EXPENSE|OTHER)

`CreatePaymentInput`: lease_id, due_date, amount, type  
`UpdatePaymentInput`: paid_date?, status, amount

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/leases/{leaseId}/payments | lista por lease |
| POST | /api/v1/leases/{leaseId}/payments | 201 payment |
| GET | /api/v1/payments/{id} | payment |
| PUT | /api/v1/payments/{id} | payment atualizado |

## Gotchas

- Sem rota DELETE — pagamentos são imutáveis (apenas atualização de status).
- `leaseID` vem do path em `create` e é injetado em `CreatePaymentInput.LeaseID` no handler (não precisa estar no body).
- Repository tem `ListByLease` (não `List` global) — não há endpoint para listar todos os pagamentos do owner.
