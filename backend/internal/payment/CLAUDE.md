# payment — Pagamentos

Vinculado a Lease. Sem Delete (pagamentos não são removidos). Listagem sempre por lease.

## Modelo

`Payment`: id, owner_id, lease_id, due_date, paid_date?, gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount?, competency?, description?, status (PENDING|PAID|LATE), type (RENT|DEPOSIT|EXPENSE|OTHER), created_at, updated_at

Inputs:
- `CreatePaymentInput`: lease_id, due_date, gross_amount, type, competency?, description?
- `UpdatePaymentInput`: paid_date?, status, gross_amount

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/leases/{leaseId}/payments | lista por lease |
| POST | /api/v1/leases/{leaseId}/payments | 201 payment |
| GET | /api/v1/payments/{id} | payment |
| PUT | /api/v1/payments/{id} | payment atualizado |
| POST | /api/v1/leases/{leaseId}/payments/generate?month=YYYY-MM | gera RENT + IPTU do mês |
| GET | /api/v1/payments/{id}/receipt | recibo (só se PAID) |

## Gotchas

- Sem rota DELETE — pagamentos são imutáveis (apenas atualização de status).
- `leaseID` vem do path em `create` e é injetado em `CreatePaymentInput.LeaseID` no handler (não precisa estar no body).
- Repository tem `ListByLease` (não `List` global) — não há endpoint para listar todos os pagamentos do owner.
- `GenerateMonth` é idempotente por `(lease_id, competency, type)`.
- `Update` com paid_date + status=PAID dispara cálculo de IRRF (se RENT + tenant PJ).
- Receipt só disponível com status PAID.
