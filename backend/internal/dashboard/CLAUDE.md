# dashboard

Read-only: agrega métricas por organização. Sem escrita, sem entidade própria.

## Endpoint

| Método | Rota | Obs |
|---|---|---|
| GET | `/api/v1/dashboard/metrics` | `Register(r, authMW, readMw)` — `readMw` injetado em `cmd/api/main.go:235` como `paymentReadMw` (`rbac.PermissionMiddleware(rbac.PermissionPaymentRead)`), ou seja, exige a permissão de leitura de pagamentos |

## `Metrics` (resposta)

`total_properties`, `total_units`, `occupied_units`, `vacancy_rate` (percentual 0-100, 2 casas), `total_tenants`, `monthly_revenue {total, paid, pending, overdue}`, `recent_payments[]`, `expiring_leases[]` (datas `YYYY-MM-DD`).

## Regras

- `NewService(repo, loc)`: `loc` define "hoje" e o mês corrente (env `APP_TIMEZONE`, default `America/Sao_Paulo`; nil = UTC). `now` é campo injetável para testes.
- `Repository.GetMetrics(ctx, orgID, now)` — escopo `organization_id`, não `owner_id`.
- `VacancyRate(total, occupied)`: 0 se não há unidades.
- Service garante listas não-nil (`[]` em vez de `null`).
- Testes: `service_test`, `handler_test`, `repository_test` (integração).
