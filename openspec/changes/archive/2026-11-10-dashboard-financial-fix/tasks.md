## 1. Dashboard Domain (Backend)

- [x] 1.1 Create `backend/internal/dashboard/model.go` with DashboardMetrics struct
- [x] 1.2 Create `backend/internal/dashboard/repository.go` with single aggregated query using CTEs
- [x] 1.3 Create `backend/internal/dashboard/service.go` calling repository
- [x] 1.4 Create `backend/internal/dashboard/handler.go` with `GET /api/v1/dashboard/metrics`
- [x] 1.5 Register dashboard handler in `main.go`

## 2. Dashboard Metrics Query

- [x] 2.1 Write SQL aggregation query for total properties and units
- [x] 2.2 Write SQL aggregation for occupied units (units with active lease)
- [x] 2.3 Write SQL aggregation for vacancy rate calculation
- [x] 2.4 Write SQL aggregation for monthly revenue by status (PAID/PENDING/OVERDUE)
- [x] 2.5 Write SQL query for recent payments (last 10, ordered by due_date DESC)
- [x] 2.6 Write SQL query for expiring leases (end_date within 30 days, ACTIVE status)
- [x] 2.7 Filter all queries by `organization_id` from context

## 3. Dashboard Frontend

- [x] 3.1 Update `frontend/src/data/dashboard/dal.ts` to call `GET /api/v1/dashboard/metrics`
- [x] 3.2 Remove N+1 requests (properties, units, tenants separate calls)
- [x] 3.3 Update dashboard page components to use aggregated metrics
- [x] 3.4 Handle loading and error states properly
- [x] 3.5 Add type for API response matching `DashboardMetrics` interface

## 4. Financial Domain (Backend)

- [x] 4.1 Create `backend/internal/financial/model.go` with Transfer, Commission, BankRecord structs (desvio: struct `Commission` não criada; comissões MVP retornam lista vazia)
- [x] 4.2 Create `backend/internal/financial/repository.go` with CRUD methods
- [x] 4.3 Create `backend/internal/financial/service.go` with transfer calculation logic
- [x] 4.4 Create `backend/internal/financial/handler.go` with routes

## 5. Financial API Routes

- [x] 5.1 Implement `GET /api/v1/financial/transfers` with status and date filters
- [x] 5.2 Implement `PUT /api/v1/financial/transfers/{id}` for status updates (PENDING→PROCESSED→TRANSFERRED)
- [x] 5.3 Implement `GET /api/v1/financial/commissions` (returns empty array in MVP)
- [x] 5.4 Implement `GET /api/v1/financial/bank-records` with date filters
- [x] 5.5 Implement `POST /api/v1/financial/bank-records/import` CSV upload and parsing
- [x] 5.6 Register financial handler in `main.go`

## 6. Transfer Calculation Logic

- [x] 6.1 Query paid payments from current month/grouped by property
- [x] 6.2 Get financial config for admin fee percentage
- [x] 6.3 Calculate net_value = gross_receipt - (gross_receipt * admin_fee_pct / 100) - discounts
- [x] 6.4 Create transfer record per property with aggregated amounts
- [x] 6.5 Implement status workflow: PENDING → PROCESSED → TRANSFERRED

## 7. Bank Reconciliation

- [x] 7.1 Create `bank_records` table in migration (if not exists)
- [x] 7.2 Implement CSV parsing for OFX/CMA compatible format (desvio: somente CSV `date,description,amount,type`; OFX fora do escopo)
- [x] 7.3 Implement auto-matching: match by amount (±5%) and date (±1 day)
- [x] 7.4 Mark matched payments as RECONCILED (desvio: vínculo via `bank_records.payment_id`; pagamento permanece `PAID`, sem status RECONCILED)
- [x] 7.5 Return unmatched records for manual review

## 8. Financial DAL (Frontend)

- [x] 8.1 Implement `getTransfers()` (desvio: implementado em `frontend/src/app/financial/actions.ts` como server action, padrão do módulo; `dal.ts` só tipa)
- [x] 8.2 Implement `getCommissions()` (returns empty array in MVP)
- [x] 8.3 Implement `getBankRecords()` with date filter (`from`/`to` AAAA-MM-DD)
- [x] 8.4 Implement `importBankRecords(file)` with CSV upload (desvio: recebe `FormData`; devolve contagens imported/duplicate/matched/unmatched)
- [x] 8.5 Implement `updateTransferStatus(id, status)` for workflow (+ `updateTransferDiscounts`, `generateTransfers`, `getAdminFee`/`setAdminFee`)

## 9. Financial Pages

- [x] 9.1 Review `/financial/receber` page — verify it uses DAL (desvio: rota real é `/financial/receivables`; página funcional via `goFetch` direto, não usa `actions.ts`; sem alteração)
- [x] 9.2 Review `/financial/pagar` page — verify it uses DAL (desvio: rota real é `/financial/payables`; mesmo caso de 9.1; sem alteração)
- [x] 9.3 Review `/financial/repasses` page — implement if stub (desvio: rota real `/financial/transfers`; implementada com geração, status, descontos e taxa ADM)
- [x] 9.4 Review `/financial/comissoes` page — implement if stub (desvio: rota real `/financial/commissions`; aviso de MVP no lugar de lista vazia silenciosa)
- [x] 9.5 Review `/financial/conciliacao` page — implement CSV import UI (desvio: rota real `/financial/reconciliation`; import CSV, sem saldo fixo e sem matching local por valor)

## 10. Testing

- [x] 10.1 Write unit tests for dashboard aggregation query
- [x] 10.2 Write unit tests for transfer calculation with admin fee
- [x] 10.3 Write unit tests for CSV parsing
- [x] 10.4 Verify all existing tests pass
- [x] 10.5 Manual testing of dashboard with sample data — EXECUTADO no navegador (`localhost:3000`, usuário `teste@inquilinotop.dev`). Dados: 2 imóveis/contratos/pagamentos PAID RENT em 2026-11 (R$3.000 e R$1.500) criados no dev DB com marcador `[SEED-DEV]`. Observado: geração de repasses → 3000 bruto, −300 taxa 10%, líquido 2700 (conforme spec); desconto editável só em PENDING (campo ausente em PROCESSED); PENDING→PROCESSED→TRANSFERRED ok. Conciliação com CSV de teste: importados 2, conciliado 1 (PIX R$3.000 ↔ pagamento), não conciliado 1 (R$777, "revisar manualmente"). Bug achado e corrigido: datas RFC3339 em "Lançamentos Pendentes" (`formatDate`). Limite: login pelo formulário não submeteu (botão preso em pending, nenhum POST /auth/login); sessão injetada via cookies obtidos de `POST /api/v1/auth/login`. Investigação do formulário fora do escopo.

## 11. Correções pós-revisão

- [x] 11.1 Prefixo `financial.csv: <operação>:` em todos os erros de parse CSV (`backend/internal/financial/csv.go`); erros sentinela mantêm `ErrInvalidCSV` via `%w`
- [x] 11.2 Soft-delete em `transfers` e `bank_records` (ADR 0001): migração `000056` adiciona `is_active` (e `updated_at` em `bank_records`), troca índices únicos por parciais `WHERE is_active`; repositório filtra `is_active` em leituras/escritas e usa `ON CONFLICT ... WHERE is_active`; testes provam que linha desativada permanece no banco, sai da listagem e não bloqueia nova geração/reimportação
- [x] 11.3 "Lançamentos Pendentes" mostra o nome do inquilino: `GET /api/v1/payments` passa a devolver `tenant_name` (subconsulta em `payment/repository.go` `List`, teste `TestPaymentRepository_List_ExpoeNomeDoInquilino`); `actions.ts` usa `tenant_name` antes de `description` e do fallback `Lease <id8>`
- [x] 11.4 Coluna PROPRIETÁRIO mantém fallback para e-mail quando o perfil não tem nome (decisão do usuário; sem alteração de código)
- [x] 11.5 Dados `[SEED-DEV]` do dev DB desativados por soft-delete (`is_active=false`): 2 imóveis, 2 unidades, 2 contratos, 2 inquilinos, 2 pagamentos, 2 repasses e 2 lançamentos bancários de teste; nada removido fisicamente
- [x] 11.6 Commit adiado pelo usuário: nenhuma alteração commitada nesta leva