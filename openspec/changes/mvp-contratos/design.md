## Context

- `lease.Lease`: unit_id, tenant_id, start/end, rent, deposit, `payment_day`, status ACTIVE|ENDED|CANCELED, multa e juros, IPTU. Operações `End`, `Renew`, `Readjust` (índice IGPM/IPCA em `index_values`), scheduler que gera pagamentos mensais.
- O service não checa sobreposição de contratos por unidade (verificado: nenhuma referência a conflito em `service.go`).
- `payment`: `Generate` por mês, LATE calculado na leitura; payments são imutáveis, sem Delete (ADR payment-0001).
- Frontend: `/leases` e `/owner/contracts` coexistem; a tela espera `notes`, ausente no modelo.

## Goals / Non-Goals

**Goals:**
- Impedir estados inválidos de contrato.
- Fechar o ciclo no frontend, ligando contrato e cobranças.

**Non-Goals:**
- Multi-inquilino, fiadores, templates de contrato, reajuste automático.
- Mudar a imutabilidade de `payment`.

## Decisions

### D1. Sobreposição verificada no service e protegida no banco
Service consulta contratos `ACTIVE` da unidade cujo período intersecta `[start, end]` (end nulo = aberto). Proteção contra corrida com `EXCLUDE USING gist (unit_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (status='ACTIVE' AND is_active)`, exigindo `btree_gist`. Alternativa: só service. Rejeitada: duas requisições simultâneas passam. Risco: extensão indisponível no Postgres gerenciado → fallback documentado para `SELECT ... FOR UPDATE` na unidade. Contratos legados sobrepostos: migration verifica e aborta com lista.

### D2. Encerrar contrato e cobranças futuras
`payment` é imutável (ADR payment-0001), então "cancelar" cobranças futuras `PENDING` usa `is_active=false` num método dedicado do repositório, nunca `Update` de valores. Pagas e vencidas ficam. Alternativa: manter pendentes futuras e só parar o scheduler. Rejeitada: polui contas a receber. Registrar em ADR de `payment` como exceção controlada.

### D3. Geração de cobranças na criação
Flag `generate_payments` no `CreateLeaseInput`. Gera por competência até `end_date`, limitado a 12 meses quando o contrato é aberto; o scheduler continua gerando os seguintes. Idempotente por `CreateIfAbsent` (já existe unicidade competência+tipo).

### D4. `notes`
Coluna `notes TEXT` (max 2000) em `leases`, opcional. Atualiza `Lease`, `CreateLeaseInput`, `UpdateLeaseInput`.

### D5. Validações no service
`end_date > start_date`; unidade (via `UnitReader`) e inquilino (via `TenantReader`) devem existir, ativos e da organização; `payment_day` 1–31. Erros de domínio com `errors.Is` e 409/422 mapeados no handler.

### D6. Frontend
Uma árvore `/leases/**`. Detalhe do contrato com abas (dados, cobranças, reajustes) via `tabs` do shadcn. Ações com `alert-dialog` e feedback via `sonner`. `/owner/contracts/**` removida com redirect. Dados de unidade e inquilino vêm da Go API.

## Risks / Trade-offs

- [`btree_gist` indisponível] → Verificar na tarefa 1.1; usar lock se faltar.
- [Cancelar pendentes futuras pode apagar cobrança já enviada ao inquilino] → Só cancela as sem `charge_id`; as com cobrança emitida ficam e são sinalizadas para decisão manual.
- [Renovar com sobreposição] → `Renew` passa pela mesma checagem.
- [Contratos legados inconsistentes] → Relatório prévio, sem alteração automática.

## Migration Plan

1. `000038_add_lease_notes` e `000039_lease_no_overlap` (extensão + exclusão) com verificação prévia.
2. Backend com testes.
3. Frontend sob `/leases`, redirect de `/owner/contracts`.
4. Rollback: down remove coluna e constraint.

## Open Questions

- Limite de 12 meses de geração inicial é adequado? Proposta: sim.
- Cobranças pendentes com `charge_id` ao encerrar: só alertar ou também cancelar a cobrança no provedor? Proposta: só alertar no MVP.
