## Fase 4 — Fiscal: IRRFTable

### Task 16: Fiscal module — skeleton + IRRFTable

**Files:**
- Create: `backend/internal/fiscal/model.go`
- Create: `backend/internal/fiscal/irrf.go`
- Create: `backend/internal/fiscal/irrf_test.go`
- Create: `backend/internal/fiscal/repository.go` (parcial — só brackets)
- Create: `backend/internal/fiscal/repository_test.go`

- [ ] **Step 1: Escrever testes de IRRFTable (unit — com mock de leitura)**

`backend/internal/fiscal/irrf_test.go`:
```go
package fiscal_test

import (
	"context"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockBracketsRepo struct {
	brackets []fiscal.IRRFBracket
}

func (m *mockBracketsRepo) ActiveBrackets(_ context.Context, at time.Time) ([]fiscal.IRRFBracket, error) {
	var out []fiscal.IRRFBracket
	for _, b := range m.brackets {
		if !b.ValidFrom.After(at) {
			out = append(out, b)
		}
	}
	return out, nil
}

func seed2024() *mockBracketsRepo {
	vf, _ := time.Parse("2006-01-02", "2024-02-01")
	max1 := 2826.65
	max2 := 3751.05
	max3 := 4664.68
	return &mockBracketsRepo{
		brackets: []fiscal.IRRFBracket{
			{ValidFrom: vf, MinBase: 0,       MaxBase: func() *float64 { x := 2259.20; return &x }(), Rate: 0,       Deduction: 0},
			{ValidFrom: vf, MinBase: 2259.21, MaxBase: &max1, Rate: 0.075, Deduction: 169.44},
			{ValidFrom: vf, MinBase: 2826.66, MaxBase: &max2, Rate: 0.15,  Deduction: 381.44},
			{ValidFrom: vf, MinBase: 3751.06, MaxBase: &max3, Rate: 0.225, Deduction: 662.77},
			{ValidFrom: vf, MinBase: 4664.69, MaxBase: nil,   Rate: 0.275, Deduction: 896.00},
		},
	}
}

func TestIRRFTable_Isento(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	v, err := tab.Calculate(context.Background(), 2000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 0, v, 0.01)
}

func TestIRRFTable_FaixaIntermediaria(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	// base 3000: faixa 3 (2826.66..3751.05), rate 0.15, dedução 381.44
	// imposto = 3000 * 0.15 - 381.44 = 450 - 381.44 = 68.56
	v, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 68.56, v, 0.01)
}

func TestIRRFTable_FaixaTopo(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	// base 10000: faixa 5, rate 0.275, dedução 896
	// imposto = 10000 * 0.275 - 896 = 2750 - 896 = 1854
	v, err := tab.Calculate(context.Background(), 10000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 1854, v, 0.01)
}

func TestIRRFTable_SemFaixaValida(t *testing.T) {
	tab := fiscal.NewIRRFTable(&mockBracketsRepo{})
	_, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.Error(t, err)
}
```

- [ ] **Step 2: Rodar — FAIL compilation**

```bash
cd backend && go test ./internal/fiscal/
```

- [ ] **Step 3: Criar model.go**

`backend/internal/fiscal/model.go`:
```go
package fiscal

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IRRFBracket struct {
	ID         uuid.UUID `json:"id"`
	ValidFrom  time.Time `json:"valid_from"`
	MinBase    float64   `json:"min_base"`
	MaxBase    *float64  `json:"max_base,omitempty"`
	Rate       float64   `json:"rate"`
	Deduction  float64   `json:"deduction"`
}

type BracketsRepository interface {
	// IRRF tabela progressiva: IN RFB 1.500/2014 art. 22. Faixas versionadas
	// por valid_from permitem atualização sem código novo quando RFB publica.
	ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error)
}

// IRRFTable é consumida por payment.Service no MarkPaid.
type IRRFTable interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}
```

- [ ] **Step 4: Criar irrf.go**

`backend/internal/fiscal/irrf.go`:
```go
package fiscal

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"
)

type irrfTable struct {
	repo BracketsRepository
}

func NewIRRFTable(repo BracketsRepository) IRRFTable {
	return &irrfTable{repo: repo}
}

func (t *irrfTable) Calculate(ctx context.Context, base float64, at time.Time) (float64, error) {
	if base < 0 {
		return 0, fmt.Errorf("fiscal.irrf: base negativa")
	}
	brackets, err := t.repo.ActiveBrackets(ctx, at)
	if err != nil {
		return 0, fmt.Errorf("fiscal.irrf: load brackets: %w", err)
	}
	if len(brackets) == 0 {
		return 0, fmt.Errorf("fiscal.irrf: sem faixas válidas para %s", at.Format("2006-01-02"))
	}
	// Dentre brackets com mesmo valid_from (o mais recente <= at), achar a faixa da base.
	sort.Slice(brackets, func(i, j int) bool { return brackets[i].ValidFrom.After(brackets[j].ValidFrom) })
	latest := brackets[0].ValidFrom
	for _, b := range brackets {
		if !b.ValidFrom.Equal(latest) {
			continue
		}
		if base < b.MinBase {
			continue
		}
		if b.MaxBase != nil && base > *b.MaxBase {
			continue
		}
		v := base*b.Rate - b.Deduction
		if v < 0 {
			v = 0
		}
		return math.Round(v*100) / 100, nil
	}
	return 0, fmt.Errorf("fiscal.irrf: sem faixa para base %.2f em %s", base, at.Format("2006-01-02"))
}
```

- [ ] **Step 5: Rodar — PASS**

```bash
cd backend && go test ./internal/fiscal/ -run IRRFTable
```

- [ ] **Step 6: Criar repository.go (pg impl)**

`backend/internal/fiscal/repository.go`:
```go
package fiscal

import (
	"context"
	"fmt"
	"time"

	"github.com/inquilinotop/api/pkg/db"
)

type pgBracketsRepository struct{ db *db.DB }

func NewBracketsRepository(database *db.DB) BracketsRepository {
	return &pgBracketsRepository{db: database}
}

func (r *pgBracketsRepository) ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, valid_from, min_base, max_base, rate, deduction
		 FROM irrf_brackets
		 WHERE valid_from = (
		   SELECT MAX(valid_from) FROM irrf_brackets WHERE valid_from <= $1
		 )
		 ORDER BY min_base`, at,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.brackets.repo: %w", err)
	}
	defer rows.Close()
	var list []IRRFBracket
	for rows.Next() {
		var b IRRFBracket
		if err := rows.Scan(&b.ID, &b.ValidFrom, &b.MinBase, &b.MaxBase, &b.Rate, &b.Deduction); err != nil {
			return nil, fmt.Errorf("fiscal.brackets.repo: scan: %w", err)
		}
		list = append(list, b)
	}
	return list, rows.Err()
}
```

- [ ] **Step 7: Teste integração do seed**

`backend/internal/fiscal/repository_test.go`:
```go
package fiscal_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() { d.Close() })
	return d
}

func TestBracketsRepository_Seed2024(t *testing.T) {
	d := testDB(t)
	repo := fiscal.NewBracketsRepository(d)
	at, _ := time.Parse("2006-01-02", "2026-04-15")
	bs, err := repo.ActiveBrackets(context.Background(), at)
	require.NoError(t, err)
	assert.Len(t, bs, 5)
	assert.InDelta(t, 0.275, bs[len(bs)-1].Rate, 0.0001)
}
```

(Note: não truncar `irrf_brackets` — é seed estática.)

- [ ] **Step 8: Rodar integração**

```bash
cd backend && go test ./internal/fiscal/ -run BracketsRepository
```

- [ ] **Step 9: Commit**

```bash
cd backend && git add internal/fiscal/
git commit -m "feat(fiscal): IRRFTable + BracketsRepository with pg impl"
```

---

