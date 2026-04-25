## Fase 3 — Payment: nova estrutura

### Task 14: Payment model — rename + campos novos + deps

**Files:**
- Modify: `backend/internal/payment/model.go`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat backend/internal/payment/model.go
```

- [ ] **Step 2: Reescrever**

```go
package payment

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID             uuid.UUID  `json:"id"`
	OwnerID        uuid.UUID  `json:"owner_id"`
	LeaseID        uuid.UUID  `json:"lease_id"`
	DueDate        time.Time  `json:"due_date"`
	PaidDate       *time.Time `json:"paid_date,omitempty"`
	GrossAmount    float64    `json:"gross_amount"`
	LateFeeAmount  float64    `json:"late_fee_amount"`
	InterestAmount float64    `json:"interest_amount"`
	IRRFAmount     float64    `json:"irrf_amount"`
	NetAmount      *float64   `json:"net_amount,omitempty"`
	Competency     *string    `json:"competency,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Status         string     `json:"status"`
	Type           string     `json:"type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID     uuid.UUID `json:"lease_id"`
	DueDate     time.Time `json:"due_date"`
	GrossAmount float64   `json:"gross_amount"`
	Type        string    `json:"type"`
	Competency  *string   `json:"competency,omitempty"`
	Description *string   `json:"description,omitempty"`
}

type UpdatePaymentInput struct {
	PaidDate    *time.Time `json:"paid_date,omitempty"`
	Status      string     `json:"status"`
	GrossAmount float64    `json:"gross_amount"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
	MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
		lateFee, interest, irrf, netAmount float64) (*Payment, error)
}
```

(`CreateIfAbsent` — insere respeitando unique index, retorna existing + `created=false` se colisão. `MarkPaid` — persiste todos os campos do pagamento quitado.)

- [ ] **Step 3: Build tenta compilar — FAIL esperada**

```bash
cd backend && go build ./... 2>&1 | head -40
```
Expected: erros em service/repository/handler/tests. Próximas tasks arrumam.

- [ ] **Step 4: Commit parcial**

```bash
cd backend && git add internal/payment/model.go
git commit -m "feat(payment): restructure model — gross/fees/irrf/net + competency"
```

---

### Task 15: Payment repository — novas queries

**Files:**
- Modify: `backend/internal/payment/repository.go`
- Modify: `backend/internal/payment/repository_test.go`

- [ ] **Step 1: Escrever testes integração**

Em `repository_test.go`, após helpers, adicionar:

```go
func TestRepository_CreateIfAbsent_Idempotente(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedOwnerAndLease(t, d) // helper que crie owner+property+unit+tenant+lease

	comp := "2026-04"
	in := payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
		Competency: &comp,
	}
	p1, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, p1)

	p2, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, p1.ID, p2.ID)
}

func TestRepository_MarkPaid_PersisteCamposDerivados(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedOwnerAndLease(t, d)
	p, err := repo.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})
	require.NoError(t, err)

	paid, err := repo.MarkPaid(context.Background(), p.ID, ownerID, time.Now(),
		200, 30, 150, 2080)
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.InDelta(t, 200, paid.LateFeeAmount, 0.01)
	assert.InDelta(t, 30,  paid.InterestAmount, 0.01)
	assert.InDelta(t, 150, paid.IRRFAmount, 0.01)
	require.NotNil(t, paid.NetAmount)
	assert.InDelta(t, 2080, *paid.NetAmount, 0.01)
}
```

- [ ] **Step 2: Rodar — FAIL (compilation)**

```bash
cd backend && go test ./internal/payment/ -run Idempotente
```

- [ ] **Step 3: Implementar repository.go**

Reescrever completo (é mais simples do que patchear):

```go
package payment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

const paymentCols = `id, owner_id, lease_id, due_date, paid_date,
  gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount,
  competency, description, status, type, created_at, updated_at`

func scanPayment(row pgx.Row, p *Payment) error {
	return row.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (lease_id, competency, type) WHERE competency IS NOT NULL DO NOTHING
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err == nil {
		return &p, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: %w", err)
	}
	// Conflito — buscar o existente
	if in.Competency == nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: insert silently skipped without competency")
	}
	var existing Payment
	err = scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+`
		 FROM payments
		 WHERE lease_id=$1 AND competency=$2 AND type=$3 AND owner_id=$4`,
		in.LeaseID, *in.Competency, in.Type, ownerID,
	), &existing)
	if err != nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent lookup: %w", err)
	}
	return &existing, false, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE lease_id=$1 AND owner_id=$2 ORDER BY due_date`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPayment(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments SET paid_date=$1, status=$2, gross_amount=$3, updated_at=NOW()
		 WHERE id=$4 AND owner_id=$5
		 RETURNING `+paymentCols,
		in.PaidDate, in.Status, in.GrossAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
	lateFee, interest, irrf, netAmount float64) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments
		 SET paid_date=$1, status='PAID',
		     late_fee_amount=$2, interest_amount=$3, irrf_amount=$4, net_amount=$5,
		     updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7
		 RETURNING `+paymentCols,
		paidDate, lateFee, interest, irrf, netAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: %w", err)
	}
	return &p, nil
}
```

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/payment/ -run Idempotente
cd backend && go test ./internal/payment/ -run MarkPaid
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/payment/repository.go internal/payment/repository_test.go
git commit -m "feat(payment): repository — CreateIfAbsent + MarkPaid + new cols"
```

---

