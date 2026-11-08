# closing — Fechamento mensal de recebimentos

Retrato (snapshot) do mês de aluguéis para o dono conferir, fechar e consultar depois. Escopo por `organization_id`. **Não trava** as cobranças: um pagamento tardio muda Recebimentos, mas não o retrato fechado.

## Modelo

`Closing`: month (AAAA-MM), status (`OPEN` | `CLOSED`), closed_at, closed_by, closed_by_name, snapshot, events.
`Snapshot`: forecast, received, overdue (`{count, total}` em valor **bruto**, como Recebimentos), receipts_issued, pending (`payment_id`, tenant, amount, due_date, awaiting).
`Event`: kind `CLOSED` | `REOPENED`, actor_id, actor_name, reason, created_at.

## Rotas (auth + permissões de pagamento: leitura no GET, escrita nos POST)

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/closings?month=AAAA-MM | estado do mês: `CLOSED` com o retrato gravado, ou `OPEN` com o retrato **calculado na hora**; histórico |
| POST | /api/v1/closings | `{month}`: fecha (201). 422 `MONTH_NOT_ENDED`, 409 `ALREADY_CLOSED`, 400 `INVALID_MONTH` |
| POST | /api/v1/closings/{month}/reopen | `{reason}` (≥ 3 caracteres): reabre (200). 400 `INVALID_REASON`, 409 `NOT_CLOSED` |

## Regras

- Só meses anteriores ao corrente em `America/Sao_Paulo` (`APP_TIMEZONE`).
- Números: cobranças `RENT` com vencimento no mês. Recebido = `PAID`; "em atraso" = todo o resto (inclui aviso do inquilino ainda não confirmado, `awaiting`). Pendências não bloqueiam.
- Um fechamento ativo por organização e mês (índice único parcial). Reabrir faz `is_active=false` (sem DELETE) e fechar de novo cria outra linha. O histórico (`month_closing_events`) é imutável e usa o relógio do banco.
- Dependências por interface: `PaymentSource` (adaptador sobre `payment.Service.List`, com nome do inquilino via contrato) e `NameReader` (perfil ou e-mail, gravado como foto no evento).
- Cálculo em memória sobre as cobranças do mês; se a base crescer, agregar em SQL.
