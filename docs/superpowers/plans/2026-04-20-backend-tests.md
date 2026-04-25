# Backend Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cobertura completa de testes (service + handler) para os domínios `property/unit`, `lease`, `payment` e `expense`.

**Architecture:** Todos os domínios já estão implementados. O domínio `unit` vive dentro do pacote `property`. Os testes seguem o padrão do projeto: mock struct local em `_test.go`, `httptest.NewRecorder` + chi router real para handlers, `testDB` helper para repositórios. Nenhum código de produção será alterado.

**Tech Stack:** Go 1.25, testify (require/assert), chi v5, httptest, uuid

---

## Mapa de arquivos

| Arquivo | Ação | Conteúdo |
|---------|------|----------|
| `backend/internal/property/service_test.go` | Modificar | Adicionar casos unit ops |
| `backend/internal/property/handler_test.go` | Modificar | Adicionar casos property + unit handlers |
| `backend/internal/lease/service_test.go` | Criar | Cobertura completa do service |
| `backend/internal/lease/handler_test.go` | Modificar | Adicionar casos CRUD além de End/Renew |
| `backend/internal/payment/service_test.go` | Criar | mockPaymentRepo + cobertura service |
| `backend/internal/payment/handler_test.go` | Criar | Cobertura handler |
| `backend/internal/expense/service_test.go` | Criar | mockExpenseRepo + cobertura service |
| `backend/internal/expense/handler_test.go` | Criar | Cobertura handler |

---

## Task 1: Expandir property/service_test.go com operações de unit

**Files:**
- Modify: `backend/internal/property/service_test.go`

- [ ] **Step 1: Adicionar testes de unit ao service_test.go existente**

Adicionar os seguintes testes ao final de `backend/internal/property/service_test.go` (o mock `mockRepo` já existe no arquivo com suporte a units):

```go
func TestService_CreateUnit_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, err := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apto 101", u.Label)
	assert.Equal(t, p.ID, u.PropertyID)
}

func TestService_CreateUnit_ImóvelSemPermissão(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()
	outroOwner := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	_, err := svc.CreateUnit(context.Background(), p.ID, outroOwner, property.CreateUnitInput{Label: "Apto 101"})
	assert.Error(t, err)
}

func TestService_GetUnit_Encontrado(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 201"})

	found, err := svc.GetUnit(context.Background(), u.ID)
	require.NoError(t, err)
	assert.Equal(t, u.ID, found.ID)
}

func TestService_GetUnit_NãoEncontrado(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.GetUnit(context.Background(), uuid.New())
	assert.Error(t, err)
}

func TestService_ListUnits(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "A"})
	svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "B"})

	list, err := svc.ListUnits(context.Background(), p.ID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_UpdateUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Original"})

	updated, err := svc.UpdateUnit(context.Background(), u.ID, property.CreateUnitInput{Label: "Atualizado"})
	require.NoError(t, err)
	assert.Equal(t, "Atualizado", updated.Label)
}

func TestService_DeleteUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Para deletar"})

	err := svc.DeleteUnit(context.Background(), u.ID)
	require.NoError(t, err)

	list, _ := svc.ListUnits(context.Background(), p.ID)
	assert.Len(t, list, 0)
}

func TestService_GetProperty_Encontrado(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})
	found, err := svc.GetProperty(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, found.ID)
}

func TestService_GetProperty_NãoEncontrado(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.GetProperty(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_UpdateProperty(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Antigo"})
	updated, err := svc.UpdateProperty(context.Background(), p.ID, ownerID, property.CreatePropertyInput{Name: "Novo"})
	require.NoError(t, err)
	assert.Equal(t, "Novo", updated.Name)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/property/... -run TestService -v
```

Esperado: todos os novos testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/property/service_test.go
git commit -m "test(property): adicionar cobertura de unit ops no service_test"
```

---

## Task 2: Expandir property/handler_test.go

**Files:**
- Modify: `backend/internal/property/handler_test.go`

- [ ] **Step 1: Adicionar testes de handler**

Adicionar ao final de `backend/internal/property/handler_test.go`:

```go
import (
	"bytes"
	"strings"
)
```

Substituir os imports existentes pelo bloco completo:

```go
import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)
```

Adicionar ao final do arquivo:

```go
func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	body, _ := json.Marshal(property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties/nao-e-uuid/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_BodyInválido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	propertyID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties/"+propertyID.String()+"/units", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_GetUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_UpdateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_DeleteUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListUnits_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties/nao-e-uuid/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/property/... -run TestHandler -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/property/handler_test.go
git commit -m "test(property): adicionar cobertura de handler tests"
```

---

## Task 3: Criar lease/service_test.go

**Files:**
- Create: `backend/internal/lease/service_test.go`

Nota: o arquivo `lease/handler_test.go` já define `mockLeaseRepo` no pacote `lease_test`. O novo `service_test.go` está no mesmo pacote e **reutiliza** `mockLeaseRepo` sem redefini-la.

- [ ] **Step 1: Criar o arquivo**

```go
package lease_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_Create_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, err := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1500,
	})
	require.NoError(t, err)
	assert.Equal(t, ownerID, l.OwnerID)
	assert.Equal(t, "ACTIVE", l.Status)
}

func TestService_Create_UnitIDNil(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	_, err := svc.Create(context.Background(), uuid.New(), lease.CreateLeaseInput{
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Create_TenantIDNil(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	_, err := svc.Create(context.Background(), uuid.New(), lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Create_RentAmountZero(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	_, err := svc.Create(context.Background(), uuid.New(), lease.CreateLeaseInput{
		UnitID:    uuid.New(),
		TenantID:  uuid.New(),
		StartDate: time.Now(),
	})
	assert.Error(t, err)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	found, err := svc.Get(context.Background(), l.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, l.ID, found.ID)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_List(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 2000,
	})

	list, err := svc.List(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_StatusInválido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	_, err := svc.Update(context.Background(), l.ID, ownerID, lease.UpdateLeaseInput{
		Status: "INVALIDO", RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Update_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	updated, err := svc.Update(context.Background(), l.ID, ownerID, lease.UpdateLeaseInput{
		Status: "ACTIVE", RentAmount: 1500,
	})
	require.NoError(t, err)
	assert.Equal(t, float64(1500), updated.RentAmount)
}

func TestService_Delete(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	err := svc.Delete(context.Background(), l.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.List(context.Background(), ownerID)
	assert.Len(t, list, 0)
}

func TestService_End(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	ended, err := svc.End(context.Background(), l.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "ENDED", ended.Status)
}

func TestService_Renew_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock)
	ownerID := uuid.New()

	l, _ := svc.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	newEnd := time.Now().Add(365 * 24 * time.Hour)
	renewed, err := svc.Renew(context.Background(), l.ID, ownerID, lease.RenewLeaseInput{
		NewEndDate: newEnd, RentAmount: 1200,
	})
	require.NoError(t, err)
	assert.Equal(t, float64(1200), renewed.RentAmount)
}

func TestService_Renew_DataZero(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	_, err := svc.Renew(context.Background(), uuid.New(), uuid.New(), lease.RenewLeaseInput{})
	assert.Error(t, err)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/lease/... -run TestService -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/lease/service_test.go
git commit -m "test(lease): adicionar service_test.go completo"
```

---

## Task 4: Expandir lease/handler_test.go com casos CRUD

**Files:**
- Modify: `backend/internal/lease/handler_test.go`

- [ ] **Step 1: Adicionar imports necessários e testes**

No `lease/handler_test.go`, o import já tem `bytes` e `encoding/json`. Adicionar `strings` se não houver. Adicionar ao final:

```go
func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	body, _ := json.Marshal(lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1500,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}
```

Verificar que o import de `strings` está presente no arquivo. Se não estiver, adicionar ao bloco de imports existente.

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/lease/... -run TestHandler -v
```

Esperado: todos os testes PASS (incluindo os 2 já existentes + os novos).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/lease/handler_test.go
git commit -m "test(lease): adicionar handler tests CRUD"
```

---

## Task 5: Criar payment/service_test.go

**Files:**
- Create: `backend/internal/payment/service_test.go`

- [ ] **Step 1: Criar o arquivo com mock e testes**

```go
package payment_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockPaymentRepo struct {
	payments map[uuid.UUID]*payment.Payment
}

func newMockPaymentRepo() *mockPaymentRepo {
	return &mockPaymentRepo{payments: make(map[uuid.UUID]*payment.Payment)}
}

func (m *mockPaymentRepo) Create(_ context.Context, ownerID uuid.UUID, in payment.CreatePaymentInput) (*payment.Payment, error) {
	p := &payment.Payment{
		ID:      uuid.New(),
		OwnerID: ownerID,
		LeaseID: in.LeaseID,
		DueDate: in.DueDate,
		Amount:  in.Amount,
		Type:    in.Type,
		Status:  "PENDING",
	}
	m.payments[p.ID] = p
	return p, nil
}

func (m *mockPaymentRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*payment.Payment, error) {
	p, ok := m.payments[id]
	if !ok || p.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return p, nil
}

func (m *mockPaymentRepo) ListByLease(_ context.Context, leaseID, ownerID uuid.UUID) ([]payment.Payment, error) {
	var list []payment.Payment
	for _, p := range m.payments {
		if p.LeaseID == leaseID && p.OwnerID == ownerID {
			list = append(list, *p)
		}
	}
	return list, nil
}

func (m *mockPaymentRepo) Update(_ context.Context, id, ownerID uuid.UUID, in payment.UpdatePaymentInput) (*payment.Payment, error) {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	p.Status = in.Status
	p.Amount = in.Amount
	p.PaidDate = in.PaidDate
	return p, nil
}

func TestService_Create_Válido(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()
	leaseID := uuid.New()

	p, err := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID,
		DueDate: time.Now(),
		Amount:  1500,
		Type:    "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, leaseID, p.LeaseID)
}

func TestService_Create_LeaseIDNil(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		DueDate: time.Now(),
		Amount:  1000,
		Type:    "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_AmountZero(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID: uuid.New(),
		DueDate: time.Now(),
		Type:    "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_TypeInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID: uuid.New(),
		DueDate: time.Now(),
		Amount:  1000,
		Type:    "INVALIDO",
	})
	assert.Error(t, err)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), Amount: 1000, Type: "RENT",
	})
	found, err := svc.Get(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, found.ID)
}

func TestService_ListByLease(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()
	leaseID := uuid.New()

	svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), Amount: 1000, Type: "RENT",
	})
	svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), Amount: 500, Type: "DEPOSIT",
	})

	list, err := svc.ListByLease(context.Background(), leaseID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_StatusInválido(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), Amount: 1000, Type: "RENT",
	})
	_, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "INVALIDO", Amount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Update_MarcarPago(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), Amount: 1000, Type: "RENT",
	})
	now := time.Now()
	updated, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "PAID", Amount: 1000, PaidDate: &now,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", updated.Status)
	assert.NotNil(t, updated.PaidDate)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/payment/... -run TestService -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/payment/service_test.go
git commit -m "test(payment): adicionar service_test.go completo"
```

---

## Task 6: Criar payment/handler_test.go

**Files:**
- Create: `backend/internal/payment/handler_test.go`

Nota: `mockPaymentRepo` já está definido em `payment/service_test.go`, mesmo pacote `payment_test`.

- [ ] **Step 1: Criar o arquivo**

```go
package payment_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func TestHandler_ListByLease_IDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByLease_Válido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/"+leaseID.String()+"/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	data, ok := body["data"]
	require.True(t, ok)
	assert.NotNil(t, data)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_LeaseIDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"due_date": time.Now(),
		"amount":   1500.0,
		"type":     "RENT",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/"+uuid.New().String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/payment/... -run TestHandler -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/payment/handler_test.go
git commit -m "test(payment): adicionar handler_test.go completo"
```

---

## Task 7: Criar expense/service_test.go

**Files:**
- Create: `backend/internal/expense/service_test.go`

- [ ] **Step 1: Criar o arquivo com mock e testes**

```go
package expense_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockExpenseRepo struct {
	expenses map[uuid.UUID]*expense.Expense
}

func newMockExpenseRepo() *mockExpenseRepo {
	return &mockExpenseRepo{expenses: make(map[uuid.UUID]*expense.Expense)}
}

func (m *mockExpenseRepo) Create(_ context.Context, ownerID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e := &expense.Expense{
		ID:          uuid.New(),
		OwnerID:     ownerID,
		UnitID:      in.UnitID,
		Description: in.Description,
		Amount:      in.Amount,
		DueDate:     in.DueDate,
		Category:    in.Category,
		IsActive:    true,
	}
	m.expenses[e.ID] = e
	return e, nil
}

func (m *mockExpenseRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*expense.Expense, error) {
	e, ok := m.expenses[id]
	if !ok || e.OwnerID != ownerID || !e.IsActive {
		return nil, errors.New("not found")
	}
	return e, nil
}

func (m *mockExpenseRepo) ListByUnit(_ context.Context, unitID, ownerID uuid.UUID) ([]expense.Expense, error) {
	var list []expense.Expense
	for _, e := range m.expenses {
		if e.UnitID == unitID && e.OwnerID == ownerID && e.IsActive {
			list = append(list, *e)
		}
	}
	return list, nil
}

func (m *mockExpenseRepo) Update(_ context.Context, id, ownerID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	e.Description = in.Description
	e.Amount = in.Amount
	e.Category = in.Category
	return e, nil
}

func (m *mockExpenseRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	e, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return errors.New("not found")
	}
	e.IsActive = false
	return nil
}

func TestService_Create_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()
	unitID := uuid.New()

	e, err := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID:      unitID,
		Description: "Água",
		Amount:      150,
		DueDate:     time.Now(),
		Category:    "WATER",
	})
	require.NoError(t, err)
	assert.Equal(t, "WATER", e.Category)
	assert.Equal(t, unitID, e.UnitID)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Luz", Amount: 100, DueDate: time.Now(), Category: "ELECTRICITY",
	})
	found, err := svc.Get(context.Background(), e.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, e.ID, found.ID)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_ListByUnit(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()
	unitID := uuid.New()

	svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Água", Amount: 100, DueDate: time.Now(), Category: "WATER",
	})
	svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Luz", Amount: 200, DueDate: time.Now(), Category: "ELECTRICITY",
	})

	list, err := svc.ListByUnit(context.Background(), unitID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Original", Amount: 100, DueDate: time.Now(), Category: "OTHER",
	})
	updated, err := svc.Update(context.Background(), e.ID, ownerID, expense.CreateExpenseInput{
		UnitID: e.UnitID, Description: "Atualizado", Amount: 200, DueDate: time.Now(), Category: "MAINTENANCE",
	})
	require.NoError(t, err)
	assert.Equal(t, "Atualizado", updated.Description)
	assert.Equal(t, "MAINTENANCE", updated.Category)
}

func TestService_Delete(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()
	unitID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Para deletar", Amount: 50, DueDate: time.Now(), Category: "OTHER",
	})
	err := svc.Delete(context.Background(), e.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.ListByUnit(context.Background(), unitID, ownerID)
	assert.Len(t, list, 0)
}
```

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/expense/... -run TestService -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/expense/service_test.go
git commit -m "test(expense): adicionar service_test.go completo"
```

---

## Task 8: Criar expense/handler_test.go

**Files:**
- Create: `backend/internal/expense/handler_test.go`

Nota: `mockExpenseRepo` já está definido em `expense/service_test.go`, mesmo pacote `expense_test`.

- [ ] **Step 1: Criar o arquivo**

```go
package expense_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func TestHandler_ListByUnit_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/nao-e-uuid/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByUnit_Válido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/"+unitID.String()+"/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	data, ok := body["data"]
	require.True(t, ok)
	assert.NotNil(t, data)
}

func TestHandler_Create_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/nao-e-uuid/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/"+unitID.String()+"/expenses", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"description": "Conta de água",
		"amount":      150.0,
		"due_date":    time.Now(),
		"category":    "WATER",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/"+unitID.String()+"/expenses", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/expenses/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/expenses/"+uuid.New().String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_NãoEncontrado(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// expense.Delete retorna erro genérico (não apierr.ErrNotFound no mock), então 500
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestHandler_Delete_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	ownerID := uuid.New()
	unitID := uuid.New()
	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Luz", Amount: 100, DueDate: time.Now(), Category: "ELECTRICITY",
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/"+e.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}
```

Adicionar `"context"` no import de `expense/handler_test.go`.

- [ ] **Step 2: Executar e verificar que passam**

```bash
cd backend && go test ./internal/expense/... -run TestHandler -v
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Rodar suite completa**

```bash
cd backend && go test ./internal/... -v 2>&1 | tail -20
```

Esperado: `ok` em todos os pacotes, zero FAIL.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/expense/handler_test.go
git commit -m "test(expense): adicionar handler_test.go completo"
```

---

## Task 9: Verificação final

**Files:** nenhum

- [ ] **Step 1: Rodar make test-backend**

```bash
make test-backend
```

Esperado: `ok` em todos os pacotes. Zero falhas.

- [ ] **Step 2: Verificar cobertura resumida**

```bash
cd backend && go test ./internal/... -cover 2>&1
```

Esperado: cada pacote com cobertura > 0%.

- [ ] **Step 3: Commit de fechamento (se necessário)**

Se houver algum ajuste residual após a verificação:

```bash
git add -p
git commit -m "test: ajustes finais na suite de testes"
```
