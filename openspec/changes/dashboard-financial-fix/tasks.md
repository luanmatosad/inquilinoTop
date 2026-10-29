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

- [ ] 4.1 Create `backend/internal/financial/model.go` with Transfer, Commission, BankRecord structs
- [ ] 4.2 Create `backend/internal/financial/repository.go` with CRUD methods
- [ ] 4.3 Create `backend/internal/financial/service.go` with transfer calculation logic
- [ ] 4.4 Create `backend/internal/financial/handler.go` with routes

## 5. Financial API Routes

- [ ] 5.1 Implement `GET /api/v1/financial/transfers` with status and date filters
- [ ] 5.2 Implement `PUT /api/v1/financial/transfers/{id}` for status updates (PENDING→PROCESSED→TRANSFERRED)
- [ ] 5.3 Implement `GET /api/v1/financial/commissions` (returns empty array in MVP)
- [ ] 5.4 Implement `GET /api/v1/financial/bank-records` with date filters
- [ ] 5.5 Implement `POST /api/v1/financial/bank-records/import` CSV upload and parsing
- [ ] 5.6 Register financial handler in `main.go`

## 6. Transfer Calculation Logic

- [ ] 6.1 Query paid payments from current month/grouped by property
- [ ] 6.2 Get financial config for admin fee percentage
- [ ] 6.3 Calculate net_value = gross_receipt - (gross_receipt * admin_fee_pct / 100) - discounts
- [ ] 6.4 Create transfer record per property with aggregated amounts
- [ ] 6.5 Implement status workflow: PENDING → PROCESSED → TRANSFERRED

## 7. Bank Reconciliation

- [ ] 7.1 Create `bank_records` table in migration (if not exists)
- [ ] 7.2 Implement CSV parsing for OFX/CMA compatible format
- [ ] 7.3 Implement auto-matching: match by amount (±5%) and date (±1 day)
- [ ] 7.4 Mark matched payments as RECONCILED
- [ ] 7.5 Return unmatched records for manual review

## 8. Financial DAL (Frontend)

- [ ] 8.1 Implement `getTransfers()` in `frontend/src/data/financial/dal.ts`
- [ ] 8.2 Implement `getCommissions()` (returns empty array in MVP)
- [ ] 8.3 Implement `getBankRecords()` with date filter
- [ ] 8.4 Implement `importBankRecords(file)` with CSV upload
- [ ] 8.5 Implement `updateTransferStatus(id, status)` for workflow

## 9. Financial Pages

- [ ] 9.1 Review `/financial/receber` page — verify it uses DAL
- [ ] 9.2 Review `/financial/pagar` page — verify it uses DAL
- [ ] 9.3 Review `/financial/repasses` page — implement if stub
- [ ] 9.4 Review `/financial/comissoes` page — implement if stub
- [ ] 9.5 Review `/financial/conciliacao` page — implement CSV import UI

## 10. Testing

- [x] 10.1 Write unit tests for dashboard aggregation query
- [ ] 10.2 Write unit tests for transfer calculation with admin fee
- [ ] 10.3 Write unit tests for CSV parsing
- [ ] 10.4 Verify all existing tests pass
- [ ] 10.5 Manual testing of dashboard with sample data