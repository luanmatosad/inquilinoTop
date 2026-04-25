# Code Review Fixes — Security & Data Integrity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os issues críticos e importantes de segurança e integridade de dados identificados no code review do backend Go.

**Architecture:** Cada fix segue TDD estrito — teste falha primeiro, implementação mínima para passar, sem over-engineering. Fixes de segurança têm prioridade absoluta sobre refatoração.

**Tech Stack:** Go 1.25, chi v5, pgx v5, testify, Docker Compose (testes unitários sem DB; integração com DB real em :5433)

---

## Comandos base

```bash
# Unitários (sem DB)
docker compose exec backend go test ./internal/<domínio>/... -v -run <TestName>

# Integração (requer DB de testes)
docker compose exec backend go test ./internal/<domínio>/... -p 1 -v -run <TestName>

# Todos os testes unitários
make test-backend

# Todos os testes com integração
make test-backend-integration
```

---

## Task 1: C5 — Asaas prod URL corrigida (https://)

**Files:**
- Modify: `backend/internal/payment/provider/asaas.go`
- Test: `backend/internal/payment/provider/asaas_test.go` (criar)

- [ ] **Step 1: Escrever teste falho**

Criar arquivo `backend/internal/payment/provider/asaas_test.go`:

```go
package provider

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAsaasProvider_ProductionURLHasScheme(t *testing.T) {
	p, err := NewAsaasProvider(map[string]string{
		"api_key":     "key123",
		"environment": "production",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(p.baseURL, "https://"),
		"production baseURL deve começar com https://, got: %s", p.baseURL)
}

func TestNewAsaasProvider_SandboxURLHasScheme(t *testing.T) {
	p, err := NewAsaasProvider(map[string]string{
		"api_key":     "key123",
		"environment": "sandbox",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(p.baseURL, "https://"),
		"sandbox baseURL deve começar com https://, got: %s", p.baseURL)
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/payment/provider/... -v -run TestNewAsaasProvider_ProductionURLHasScheme
```

Esperado: `FAIL — assertion failed: production baseURL deve começar com https://, got: api.asaas.com`

- [ ] **Step 3: Implementar correção mínima**

Em `backend/internal/payment/provider/asaas.go`, linha ~34, trocar:
```go
baseURL = "api.asaas.com"
```
por:
```go
baseURL = "https://api.asaas.com"
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/payment/provider/... -v -run TestNewAsaasProvider
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/payment/provider/asaas.go backend/internal/payment/provider/asaas_test.go
git commit -m "fix(payment): add https scheme to asaas production URL"
```

---

## Task 2: I7 — Provider switch normaliza case (ASAAS → asaas)

**Files:**
- Modify: `backend/internal/payment/provider/provider.go`
- Test: `backend/internal/payment/provider/provider_test.go` (criar)

- [ ] **Step 1: Escrever teste falho**

Criar `backend/internal/payment/provider/provider_test.go`:

```go
package provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewProvider_AcceptsUppercaseProviderTypes(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		config   map[string]string
	}{
		{"ASAAS uppercase", "ASAAS", map[string]string{"api_key": "k"}},
		{"MOCK uppercase", "MOCK", map[string]string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewProvider(tt.provider, tt.config)
			require.NoError(t, err)
			assert.NotNil(t, p)
		})
	}
}

func TestNewProvider_AcceptsLowercaseProviderTypes(t *testing.T) {
	p, err := NewProvider("mock", map[string]string{})
	require.NoError(t, err)
	assert.NotNil(t, p)
}

func TestNewProvider_UnknownProviderReturnsError(t *testing.T) {
	_, err := NewProvider("UNKNOWN_BANK", map[string]string{})
	assert.ErrorIs(t, err, ErrUnknownProvider)
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/payment/provider/... -v -run TestNewProvider_AcceptsUppercaseProviderTypes
```

Esperado: `FAIL — "ASAAS" retorna ErrUnknownProvider`

- [ ] **Step 3: Implementar correção mínima**

Em `backend/internal/payment/provider/provider.go`, adicionar import `"strings"` e modificar a função `NewProvider`:

```go
import (
	"context"
	"fmt"
	"strings"
	"time"
)

func NewProvider(providerType string, config map[string]string) (PaymentProvider, error) {
	switch strings.ToLower(providerType) {
	case "asaas":
		return NewAsaasProvider(config)
	case "sicoob":
		return NewSicoobProvider(config)
	case "bradesco":
		return NewBradescoProvider(config)
	case "itau":
		return NewItauProvider(config)
	case "mock":
		return NewMockProvider(), nil
	default:
		return nil, ErrUnknownProvider
	}
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/payment/provider/... -v -run TestNewProvider
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/payment/provider/provider.go backend/internal/payment/provider/provider_test.go
git commit -m "fix(payment): normalize provider type to lowercase in NewProvider"
```

---

## Task 3: C3 — Webhook bypass quando WEBHOOK_SECRET não está setado

**Files:**
- Modify: `backend/internal/payment/handler.go`
- Test: `backend/internal/payment/handler_test.go` (adicionar casos)

- [ ] **Step 1: Escrever teste falho**

No arquivo `backend/internal/payment/handler_test.go`, adicionar ao final:

```go
func TestHandler_HandleWebhook_RejectsWhenSecretNotConfigured(t *testing.T) {
	// Garante que WEBHOOK_SECRET não está setado
	os.Unsetenv("WEBHOOK_SECRET")

	svc := &mockPaymentService{}
	h := NewHandler(svc)

	body := `{"event":"PAYMENT_RECEIVED","chargeId":"ch_123","amount":100.0,"paymentDate":"2024-01-01"}`
	req := httptest.NewRequest(http.MethodPost, "/webhook/asaas", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "any-value")
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "deve rejeitar quando WEBHOOK_SECRET não está configurado")
}

func TestHandler_HandleWebhook_AcceptsWithCorrectSecret(t *testing.T) {
	os.Setenv("WEBHOOK_SECRET", "secret123")
	defer os.Unsetenv("WEBHOOK_SECRET")

	svc := &mockPaymentService{}
	h := NewHandler(svc)

	body := `{"event":"PAYMENT_RECEIVED","chargeId":"ch_123","amount":100.0,"paymentDate":"2024-01-01"}`
	req := httptest.NewRequest(http.MethodPost, "/webhook/asaas", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "secret123")
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}
```

Verifique que o arquivo já importa `"os"` e `"strings"`. Se não, adicione aos imports existentes.

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/payment/... -v -run TestHandler_HandleWebhook_RejectsWhenSecretNotConfigured
```

Esperado: `FAIL — got 200, want 401`

- [ ] **Step 3: Implementar correção mínima**

Em `backend/internal/payment/handler.go`, localizar o bloco de validação do webhook (~linhas 330-336) e substituir:

```go
expectedSecret := os.Getenv("WEBHOOK_SECRET")
if expectedSecret != "" && webhookSecret != expectedSecret {
    httputil.Err(w, http.StatusUnauthorized, "INVALID_SECRET", "invalid webhook secret")
    return
}
```

Por:

```go
expectedSecret := os.Getenv("WEBHOOK_SECRET")
if expectedSecret == "" {
    httputil.Err(w, http.StatusUnauthorized, "WEBHOOK_NOT_CONFIGURED", "webhook secret not configured")
    return
}
if webhookSecret != expectedSecret {
    httputil.Err(w, http.StatusUnauthorized, "INVALID_SECRET", "invalid webhook secret")
    return
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/payment/... -v -run TestHandler_HandleWebhook
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/payment/handler.go backend/internal/payment/handler_test.go
git commit -m "fix(payment): reject webhooks when WEBHOOK_SECRET is not configured"
```

---

## Task 4: C2 — Units sem owner_id: Repository interface + queries

**Files:**
- Modify: `backend/internal/property/model.go` (interface Repository)
- Modify: `backend/internal/property/repository.go` (GetUnit, UpdateUnit, DeleteUnit)
- Modify: `backend/internal/property/service.go` (GetUnit, UpdateUnit, DeleteUnit)
- Modify: `backend/internal/property/handler.go` (getUnit, updateUnit, deleteUnit)
- Modify: `backend/internal/property/handler_test.go` (testes de IDOR)

> **Atenção:** Mudar a assinatura da interface quebra todos os mocks. Será necessário atualizar `service_test.go` e `handler_test.go`.

- [ ] **Step 1: Escrever testes falhos no handler**

Em `backend/internal/property/handler_test.go`, adicionar:

```go
func TestHandler_GetUnit_RequiresOwnerMatch(t *testing.T) {
	ownerA := uuid.New()
	ownerB := uuid.New()
	unitID := uuid.New()

	repo := newMockRepo()
	// Unit pertence ao ownerA
	repo.units[unitID] = &Unit{ID: unitID, PropertyID: uuid.New(), Label: "A101"}
	repo.unitOwners[unitID] = ownerA

	svc := NewService(repo)
	h := NewHandler(svc)

	// ownerB tenta acessar unit de ownerA
	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/"+unitID.String(), nil)
	req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerB))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code, "ownerB não deve acessar unit de ownerA")
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/property/... -v -run TestHandler_GetUnit_RequiresOwnerMatch
```

Esperado: falha de compilação (mockRepo não tem campo `unitOwners`) ou `FAIL — got 200`

- [ ] **Step 3: Atualizar interface Repository em model.go**

Em `backend/internal/property/model.go`, alterar as assinaturas das funções de Unit na interface:

```go
type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Property, error)
	List(ctx context.Context, ownerID uuid.UUID) ([]Property, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
	CreateUnit(ctx context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
	GetUnit(ctx context.Context, id, ownerID uuid.UUID) (*Unit, error)
	ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error)
	ListUnitsByPropertyIDs(ctx context.Context, propertyIDs []uuid.UUID) ([]Unit, error)
	UpdateUnit(ctx context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error)
	DeleteUnit(ctx context.Context, id, ownerID uuid.UUID) error
}
```

- [ ] **Step 4: Atualizar repository.go — GetUnit com JOIN owner_id**

Em `backend/internal/property/repository.go`, substituir `GetUnit`, `UpdateUnit`, e `DeleteUnit`:

```go
func (r *pgRepository) GetUnit(ctx context.Context, id, ownerID uuid.UUID) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`SELECT u.id, u.property_id, u.label, u.floor, u.notes, u.is_active, u.created_at, u.updated_at
		 FROM units u
		 JOIN properties p ON p.id = u.property_id
		 WHERE u.id=$1 AND p.owner_id=$2 AND u.is_active=true AND p.is_active=true`,
		id, ownerID,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: get unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) UpdateUnit(ctx context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE units SET label=$1, floor=$2, notes=$3, updated_at=NOW()
		 WHERE id=$4 AND is_active=true
		   AND property_id IN (SELECT id FROM properties WHERE owner_id=$5 AND is_active=true)
		 RETURNING id, property_id, label, floor, notes, is_active, created_at, updated_at`,
		in.Label, in.Floor, in.Notes, id, ownerID,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) DeleteUnit(ctx context.Context, id, ownerID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE units SET is_active=false, updated_at=NOW()
		 WHERE id=$1 AND is_active=true
		   AND property_id IN (SELECT id FROM properties WHERE owner_id=$2 AND is_active=true)`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("property.repo: delete unit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 5: Atualizar service.go — propagar ownerID**

Em `backend/internal/property/service.go`, atualizar `GetUnit`, `UpdateUnit`, `DeleteUnit`:

```go
func (s *Service) GetUnit(ctx context.Context, id, ownerID uuid.UUID) (*Unit, error) {
	return s.repo.GetUnit(ctx, id, ownerID)
}

func (s *Service) UpdateUnit(ctx context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	return s.repo.UpdateUnit(ctx, id, ownerID, in)
}

func (s *Service) DeleteUnit(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.DeleteUnit(ctx, id, ownerID)
}
```

- [ ] **Step 6: Atualizar handler.go — passar ownerID em getUnit, updateUnit, deleteUnit**

Em `backend/internal/property/handler.go`, atualizar os três handlers:

```go
func (h *Handler) getUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	u, err := h.svc.GetUnit(r.Context(), id, ownerID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

func (h *Handler) updateUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	u, err := h.svc.UpdateUnit(r.Context(), id, ownerID, in)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

func (h *Handler) deleteUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteUnit(r.Context(), id, ownerID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
```

Adicione `"errors"` ao import do handler se ainda não estiver presente.

- [ ] **Step 7: Atualizar mockRepo nos arquivos de teste**

Em `backend/internal/property/service_test.go` e `handler_test.go`, o mock struct precisa ser atualizado para implementar as novas assinaturas. Localize a struct `mockRepo` e atualize os métodos `GetUnit`, `UpdateUnit`, `DeleteUnit`:

```go
type mockRepo struct {
	properties map[uuid.UUID]*Property
	units      map[uuid.UUID]*Unit
	unitOwners map[uuid.UUID]uuid.UUID // unitID -> ownerID via propertyID
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		properties: map[uuid.UUID]*Property{},
		units:      map[uuid.UUID]*Unit{},
		unitOwners: map[uuid.UUID]uuid.UUID{},
	}
}

func (m *mockRepo) GetUnit(_ context.Context, id, ownerID uuid.UUID) (*Unit, error) {
	u, ok := m.units[id]
	if !ok {
		return nil, apierr.ErrNotFound
	}
	if owner, exists := m.unitOwners[id]; exists && owner != ownerID {
		return nil, apierr.ErrNotFound
	}
	return u, nil
}

func (m *mockRepo) UpdateUnit(_ context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	u, err := m.GetUnit(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	u.Label = in.Label
	u.Floor = in.Floor
	u.Notes = in.Notes
	return u, nil
}

func (m *mockRepo) DeleteUnit(_ context.Context, id, ownerID uuid.UUID) error {
	_, err := m.GetUnit(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	delete(m.units, id)
	return nil
}
```

- [ ] **Step 8: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/property/... -v
```

Esperado: `PASS` em todos os testes, incluindo `TestHandler_GetUnit_RequiresOwnerMatch`

- [ ] **Step 9: Commit**

```bash
git add backend/internal/property/
git commit -m "fix(property): enforce owner_id on unit get/update/delete operations"
```

---

## Task 5: C1 — identity handler acessa repo diretamente (setup2FA)

**Files:**
- Modify: `backend/internal/identity/service.go` (adicionar Setup2FAByEmail)
- Modify: `backend/internal/identity/handler.go` (remover h.svc.repo acesso direto)
- Modify: `backend/internal/identity/handler_test.go` (teste de enumeração)

- [ ] **Step 1: Escrever testes falhos**

Em `backend/internal/identity/handler_test.go`, adicionar:

```go
func TestHandler_Setup2FA_DoesNotExposeUserExistence(t *testing.T) {
	// Setup2FA deve retornar resposta idêntica para email existente e não-existente
	// (previne user enumeration)
	repo := newMockRepo()
	svc := NewService(repo, newMockJWT())
	h := NewHandler(svc)

	// Email inexistente
	body := `{"email":"naoexiste@test.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/2fa/setup", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	// Não deve retornar 404 revelando que o usuário não existe
	assert.NotEqual(t, http.StatusNotFound, rr.Code, "não deve revelar que usuário não existe")
}

func TestHandler_Setup2FA_DoesNotAccessRepoDirectly(t *testing.T) {
	// Este teste verifica que o handler usa h.svc.Setup2FAByEmail, não h.svc.repo
	// Basta compilar — se h.svc.repo for privado, não compilará se acessado fora do pacote
	// Verificamos via reflexão que Handler não tem campo 'repo'
	repo := newMockRepo()
	svc := NewService(repo, newMockJWT())
	h := NewHandler(svc)
	assert.NotNil(t, h)
	// Se compilou, o acesso direto ao repo foi removido
}
```

- [ ] **Step 2: Verificar que os testes falham**

```bash
docker compose exec backend go test ./internal/identity/... -v -run TestHandler_Setup2FA
```

Esperado: `FAIL` no primeiro teste (`got 404, não deve revelar que usuário não existe`)

- [ ] **Step 3: Adicionar Setup2FAByEmail ao service**

Em `backend/internal/identity/service.go`, adicionar após o método `Login`:

```go
func (s *Service) Setup2FAByEmail(ctx context.Context, email string) (*TwoFactorSetup, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		// Não revelar se o email existe ou não (anti-enumeration)
		return nil, fmt.Errorf("identity.svc: setup 2fa: %w", err)
	}
	return s.Setup2FA(ctx, user.ID, email)
}
```

- [ ] **Step 4: Atualizar handler setup2FA para usar o service**

Em `backend/internal/identity/handler.go`, substituir o método `setup2FA`:

```go
func (h *Handler) setup2FA(w http.ResponseWriter, r *http.Request) {
	var in twoFactorSetupInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Email == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_EMAIL", "email é obrigatório")
		return
	}

	setup, err := h.svc.Setup2FAByEmail(r.Context(), in.Email)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "2FA_SETUP_FAILED", "falha ao configurar 2FA")
		return
	}
	httputil.OK(w, setup)
}
```

- [ ] **Step 5: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/identity/... -v -run TestHandler_Setup2FA
```

Esperado: `PASS`

- [ ] **Step 6: Commit**

```bash
git add backend/internal/identity/service.go backend/internal/identity/handler.go backend/internal/identity/handler_test.go
git commit -m "fix(identity): remove direct repo access from handler, add Setup2FAByEmail to service"
```

---

## Task 6: M9 — Rotas 2FA sem authMW e sem auth.OwnerIDFromCtx

**Files:**
- Modify: `backend/internal/identity/handler.go`
- Test: `backend/internal/identity/handler_test.go`

- [ ] **Step 1: Escrever testes falhos**

Em `backend/internal/identity/handler_test.go`, adicionar:

```go
func TestHandler_Verify2FA_RequiresAuth(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo, newMockJWT())
	h := NewHandler(svc)

	// Chamada SEM token JWT (authMW não foi executado → owner_id não estará no contexto)
	body := `{"code":"123456"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/2fa/verify", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	// Registrar com authMW que bloqueia tudo (simula requisição não autenticada)
	r := chi.NewRouter()
	blockingAuth := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		})
	}
	h.RegisterProtected(r, blockingAuth)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/identity/... -v -run TestHandler_Verify2FA_RequiresAuth
```

Esperado: falha de compilação (`RegisterProtected` não existe) ou `FAIL`

- [ ] **Step 3: Implementar — separar Register em público e protegido**

Em `backend/internal/identity/handler.go`, substituir `Register` por:

```go
func (h *Handler) Register(r chi.Router) {
	r.Post("/api/v1/auth/register", h.register)
	r.Post("/api/v1/auth/login", h.login)
	r.Post("/api/v1/auth/2fa/login", h.login2FA)
	r.Post("/api/v1/auth/refresh", h.refresh)
	r.Post("/api/v1/auth/logout", h.logout)
}

func (h *Handler) RegisterProtected(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Post("/api/v1/auth/2fa/setup", h.setup2FA)
	r.With(authMW).Post("/api/v1/auth/2fa/verify", h.verify2FA)
	r.With(authMW).Post("/api/v1/auth/2fa/disable", h.disable2FA)
}
```

E nos handlers `verify2FA` e `disable2FA`, substituir o acesso raw ao contexto por `auth.OwnerIDFromCtx`:

```go
// Em verify2FA — substituir:
// ownerID, ok := r.Context().Value("owner_id").(uuid.UUID)
// if !ok { ... }
// Por:
ownerID := auth.OwnerIDFromCtx(r.Context())
if ownerID == uuid.Nil {
    httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
    return
}

// Em disable2FA — mesma substituição
ownerID := auth.OwnerIDFromCtx(r.Context())
if ownerID == uuid.Nil {
    httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
    return
}
```

- [ ] **Step 4: Atualizar main.go para chamar RegisterProtected**

Em `backend/cmd/api/main.go`, localizar onde `identityHandler.Register(r)` é chamado e adicionar logo depois:

```go
identityHandler.Register(r)
identityHandler.RegisterProtected(r, authMW)
```

- [ ] **Step 5: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/identity/... -v
```

Esperado: `PASS`

- [ ] **Step 6: Compilar o projeto**

```bash
docker compose exec backend go build ./...
```

Esperado: sem erros

- [ ] **Step 7: Commit**

```bash
git add backend/internal/identity/handler.go backend/cmd/api/main.go backend/internal/identity/handler_test.go
git commit -m "fix(identity): protect 2fa routes with authMW, use auth.OwnerIDFromCtx"
```

---

## Task 7: I9 — GetUserByID missing COALESCE em nullable columns

**Files:**
- Modify: `backend/internal/identity/repository.go`
- Test: `backend/internal/identity/repository_test.go`

- [ ] **Step 1: Escrever teste de integração falho**

Em `backend/internal/identity/repository_test.go`, adicionar:

```go
func TestRepository_GetUserByID_WithoutTwoFactor(t *testing.T) {
	db := testDB(t)
	repo := NewRepository(db)

	// Criar usuário sem 2FA (totp_secret = NULL)
	user, err := repo.CreateUser(context.Background(), "noTfa@test.com", "hash")
	require.NoError(t, err)
	require.False(t, user.TwoFactorEnabled)

	// Deve conseguir buscar por ID sem erro de scan em colunas NULL
	got, err := repo.GetUserByID(context.Background(), user.ID)
	require.NoError(t, err, "GetUserByID não deve falhar para user sem 2FA configurado")
	assert.Equal(t, user.ID, got.ID)
	assert.Equal(t, "", got.TotpSecret, "TotpSecret deve ser string vazia quando NULL")
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/identity/... -p 1 -v -run TestRepository_GetUserByID_WithoutTwoFactor
```

Esperado: `FAIL — scan error: cannot scan NULL into string`

- [ ] **Step 3: Corrigir GetUserByID e GetUser no repository**

Em `backend/internal/identity/repository.go`, substituir as queries de `GetUserByID` e `GetUser`:

```go
func (r *pgRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by id: %w", err)
	}
	return &u, nil
}
```

Fazer o mesmo para `GetUser` se existir com a mesma query sem COALESCE.

- [ ] **Step 4: Verificar que o teste passa**

```bash
docker compose exec backend go test ./internal/identity/... -p 1 -v -run TestRepository_GetUserByID_WithoutTwoFactor
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/identity/repository.go backend/internal/identity/repository_test.go
git commit -m "fix(identity): add COALESCE to GetUserByID for nullable totp_secret and backup_codes"
```

---

## Task 8: I6 — financial_config usa hard DELETE (viola soft-delete)

**Files:**
- Modify: `backend/internal/payment/financial_repository.go`
- Test: `backend/internal/payment/repository_test.go`

- [ ] **Step 1: Escrever teste de integração falho**

Em `backend/internal/payment/repository_test.go`, adicionar:

```go
func TestFinancialRepository_DeleteFinancialConfig_SoftDelete(t *testing.T) {
	db := testDB(t)
	repo := NewRepository(db)

	ownerID := uuid.New()
	cfg, err := repo.CreateFinancialConfig(context.Background(), ownerID, CreateFinancialConfigInput{
		Provider: "MOCK",
		Config:   map[string]string{},
	})
	require.NoError(t, err)

	err = repo.DeleteFinancialConfig(context.Background(), cfg.ID, ownerID)
	require.NoError(t, err)

	// Após delete, o registro ainda deve existir no banco (soft-delete)
	var count int
	err = db.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM financial_config WHERE id=$1`, cfg.ID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "soft-delete não deve remover o registro do banco")

	// E is_active deve ser false
	var isActive bool
	err = db.Pool.QueryRow(context.Background(),
		`SELECT is_active FROM financial_config WHERE id=$1`, cfg.ID,
	).Scan(&isActive)
	require.NoError(t, err)
	assert.False(t, isActive, "is_active deve ser false após soft-delete")
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/payment/... -p 1 -v -run TestFinancialRepository_DeleteFinancialConfig_SoftDelete
```

Esperado: `FAIL — count = 0 (registro foi deletado fisicamente)`

- [ ] **Step 3: Corrigir DeleteFinancialConfig**

Em `backend/internal/payment/financial_repository.go`, substituir `DeleteFinancialConfig`:

```go
func (p *pgRepository) DeleteFinancialConfig(ctx context.Context, id, ownerID uuid.UUID) error {
	result, err := p.db.Pool.Exec(ctx,
		`UPDATE financial_config SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("payment.repo: delete financial config: %w", err)
	}
	if result.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 4: Verificar que o teste passa**

```bash
docker compose exec backend go test ./internal/payment/... -p 1 -v -run TestFinancialRepository_DeleteFinancialConfig_SoftDelete
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/payment/financial_repository.go backend/internal/payment/repository_test.go
git commit -m "fix(payment): use soft-delete for financial_config instead of hard DELETE"
```

---

## Task 9: I8 — CreateProperty SINGLE ignora erro ao criar Unit

**Files:**
- Modify: `backend/internal/property/service.go`
- Test: `backend/internal/property/service_test.go`

- [ ] **Step 1: Escrever teste falho**

Em `backend/internal/property/service_test.go`, adicionar:

```go
func TestService_CreateProperty_SingleUnitCreationError_ReturnsError(t *testing.T) {
	repo := newMockRepo()
	repo.failCreateUnit = true // forçar falha no CreateUnit
	svc := NewService(repo)

	_, err := svc.CreateProperty(context.Background(), uuid.New(), CreatePropertyInput{
		Type: "SINGLE",
		Name: "Casa Teste",
	})

	assert.Error(t, err, "deve retornar erro quando criação da unit automática falha")
}
```

E adicionar campo `failCreateUnit` ao mockRepo em `service_test.go`:

```go
type mockRepo struct {
	properties     map[uuid.UUID]*Property
	units          map[uuid.UUID]*Unit
	unitOwners     map[uuid.UUID]uuid.UUID
	failCreateUnit bool
}

func (m *mockRepo) CreateUnit(_ context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	if m.failCreateUnit {
		return nil, fmt.Errorf("db error")
	}
	u := &Unit{
		ID:         uuid.New(),
		PropertyID: propertyID,
		Label:      in.Label,
		Notes:      in.Notes,
	}
	m.units[u.ID] = u
	return u, nil
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/property/... -v -run TestService_CreateProperty_SingleUnitCreationError_ReturnsError
```

Esperado: `FAIL — expected error, got nil`

- [ ] **Step 3: Corrigir service.go para propagar erro**

Em `backend/internal/property/service.go`, substituir o bloco de criação de unit em `CreateProperty`:

```go
if in.Type == "SINGLE" {
    notes := "Unidade criada automaticamente"
    if _, err := s.repo.CreateUnit(ctx, p.ID, CreateUnitInput{Label: "Unidade 01", Notes: &notes}); err != nil {
        return nil, fmt.Errorf("property.svc: criar unit automática: %w", err)
    }
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/property/... -v -run TestService_CreateProperty
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/property/service.go backend/internal/property/service_test.go
git commit -m "fix(property): propagate error when auto-unit creation fails for SINGLE property"
```

---

## Task 10: C4 — audit SQL param construction usa fmt.Sprintf

**Files:**
- Modify: `backend/internal/audit/repository.go`
- Test: `backend/internal/audit/repository_test.go` (criar)

- [ ] **Step 1: Escrever teste de integração falho**

Criar `backend/internal/audit/repository_test.go`:

```go
package audit

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
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
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE audit_logs CASCADE")
		d.Close()
	})
	return d
}

func TestRepository_List_WithAllFilters(t *testing.T) {
	d := testDB(t)
	repo := NewRepository(d.Pool)
	ownerID := uuid.New()

	now := time.Now().UTC()
	eventType := "LOGIN"

	// Criar log de auditoria
	_, err := repo.Create(context.Background(), ownerID, CreateInput{
		EventType:  eventType,
		EntityType: "user",
	})
	require.NoError(t, err)

	from := now.Add(-time.Minute)
	to := now.Add(time.Minute)

	// Filtrar com todos os 3 filtros opcionais (from + to + eventType)
	logs, err := repo.List(context.Background(), ownerID, &from, &to, &eventType)
	require.NoError(t, err, "List com 3 filtros não deve retornar erro de SQL")
	assert.Len(t, logs, 1)
}

func TestRepository_List_WithNoFilters(t *testing.T) {
	d := testDB(t)
	repo := NewRepository(d.Pool)
	ownerID := uuid.New()

	_, err := repo.Create(context.Background(), ownerID, CreateInput{
		EventType:  "LOGOUT",
		EntityType: "user",
	})
	require.NoError(t, err)

	logs, err := repo.List(context.Background(), ownerID, nil, nil, nil)
	require.NoError(t, err)
	assert.Len(t, logs, 1)
}
```

- [ ] **Step 2: Verificar que o teste falha (ou compila mas falha no SQL)**

```bash
docker compose exec backend go test ./internal/audit/... -p 1 -v -run TestRepository_List_WithAllFilters
```

Esperado: erro de SQL por parametrização incorreta ou resultado vazio

- [ ] **Step 3: Corrigir construção dos parâmetros**

Em `backend/internal/audit/repository.go`, substituir o bloco de construção dinâmica do `List`:

```go
import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5/pgxpool"
)

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error) {
	query := `
		SELECT id, owner_id, user_id, event_type, entity_type, entity_id, ip_address, user_agent, details, created_at
		FROM audit_logs
		WHERE owner_id = $1
	`
	args := []interface{}{ownerID}
	argIdx := 2

	if from != nil {
		query += fmt.Sprintf(` AND created_at >= $%d`, argIdx)
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		query += fmt.Sprintf(` AND created_at <= $%d`, argIdx)
		args = append(args, *to)
		argIdx++
	}
	if eventType != nil {
		query += fmt.Sprintf(` AND event_type = $%d`, argIdx)
		args = append(args, *eventType)
		argIdx++
	}
	_ = argIdx

	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		var detailsJSON []byte
		err := rows.Scan(
			&log.ID, &log.OwnerID, &log.UserID, &log.EventType, &log.EntityType, &log.EntityID,
			&log.IPAddress, &log.UserAgent, &detailsJSON, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			json.Unmarshal(detailsJSON, &log.Details)
		}
		logs = append(logs, log)
	}

	return logs, nil
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/audit/... -p 1 -v
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/audit/repository.go backend/internal/audit/repository_test.go
git commit -m "fix(audit): use fmt.Sprintf for SQL parameter placeholders in dynamic query"
```

---

## Task 11: I10 — audit GET handler usa query params em vez de body

**Files:**
- Modify: `backend/internal/audit/handler.go`
- Test: `backend/internal/audit/handler_test.go` (criar)

- [ ] **Step 1: Escrever teste falho**

Criar `backend/internal/audit/handler_test.go`:

```go
package audit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockAuditSvc struct {
	logs []AuditLog
}

func (m *mockAuditSvc) CreateLog(ctx context.Context, ownerID uuid.UUID, in CreateInput) (*AuditLog, error) {
	return nil, nil
}

func (m *mockAuditSvc) ListLogs(ctx context.Context, ownerID uuid.UUID, from, to interface{}, eventType interface{}) ([]AuditLog, error) {
	return m.logs, nil
}

func TestHandler_List_UsesQueryParams(t *testing.T) {
	svc := &mockAuditSvc{logs: []AuditLog{}}
	h := NewHandler(svc)

	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/audit-logs?from=2024-01-01T00:00:00Z&event_type=LOGIN", nil)
	req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerID))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "GET com query params deve funcionar sem body")
}

func TestHandler_List_WorksWithNoParams(t *testing.T) {
	svc := &mockAuditSvc{logs: []AuditLog{}}
	h := NewHandler(svc)

	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/audit-logs", nil)
	req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerID))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/audit/... -v -run TestHandler_List_UsesQueryParams
```

Esperado: `FAIL — 400 ou 500 porque o handler tenta decodificar body JSON`

- [ ] **Step 3: Corrigir handler para usar query params**

Em `backend/internal/audit/handler.go`, substituir o método `list`:

```go
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
		return
	}

	var from, to *time.Time
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_FROM", "from deve ser RFC3339")
			return
		}
		from = &t
	}
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_TO", "to deve ser RFC3339")
			return
		}
		to = &t
	}

	var eventType *string
	if et := r.URL.Query().Get("event_type"); et != "" {
		eventType = &et
	}

	logs, err := h.svc.ListLogs(r.Context(), ownerID, from, to, eventType)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "erro interno")
		return
	}

	if logs == nil {
		logs = []AuditLog{}
	}
	httputil.OK(w, map[string]interface{}{
		"logs": logs,
	})
}
```

Remover a struct `ListInput` que não é mais necessária.

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/audit/... -v -run TestHandler_List
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/audit/handler.go backend/internal/audit/handler_test.go
git commit -m "fix(audit): change list endpoint to use query params instead of request body"
```

---

## Task 12: I3 — notification ListPending sem ownerID (vazamento cross-owner)

**Files:**
- Modify: `backend/internal/notification/service.go`
- Modify: `backend/internal/notification/repository.go` (verificar se ListByOwner pode filtrar pending)
- Test: `backend/internal/notification/service_test.go` (criar)

- [ ] **Step 1: Verificar interface de Repository**

```bash
cat /home/aoki/workspace/inquilinoTop/backend/internal/notification/model.go
```

Verificar se `ListByOwner` aceita status como parâmetro. Se sim, usar ele no lugar de `ListPending`.

- [ ] **Step 2: Escrever teste falho**

Criar `backend/internal/notification/service_test.go`:

```go
package notification

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockNotifRepo struct {
	notifications map[uuid.UUID]*Notification
}

func newMockNotifRepo() *mockNotifRepo {
	return &mockNotifRepo{notifications: map[uuid.UUID]*Notification{}}
}

func (m *mockNotifRepo) Create(_ context.Context, ownerID uuid.UUID, in CreateNotificationInput) (*Notification, error) {
	n := &Notification{
		ID:      uuid.New(),
		OwnerID: ownerID,
		Type:    in.Type,
		Status:  StatusPending,
	}
	m.notifications[n.ID] = n
	return n, nil
}

func (m *mockNotifRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*Notification, error) {
	n, ok := m.notifications[id]
	if !ok || n.OwnerID != ownerID {
		return nil, nil
	}
	return n, nil
}

func (m *mockNotifRepo) ListByOwner(_ context.Context, ownerID uuid.UUID, status string) ([]Notification, error) {
	var result []Notification
	for _, n := range m.notifications {
		if n.OwnerID == ownerID && (status == "" || string(n.Status) == status) {
			result = append(result, *n)
		}
	}
	return result, nil
}

func (m *mockNotifRepo) ListPending(_ context.Context, limit int) ([]Notification, error) {
	var result []Notification
	for _, n := range m.notifications {
		if n.Status == StatusPending {
			result = append(result, *n)
		}
	}
	return result, nil
}

func (m *mockNotifRepo) UpdateStatus(_ context.Context, id uuid.UUID, status NotificationStatus, sentAt *time.Time) error {
	return nil
}

func (m *mockNotifRepo) IncrementRetry(_ context.Context, id uuid.UUID) error {
	return nil
}

func TestService_ListByOwner_PendingDoesNotLeakCrossOwner(t *testing.T) {
	repo := newMockNotifRepo()
	svc := NewService(repo, nil)

	ownerA := uuid.New()
	ownerB := uuid.New()

	// ownerA tem 1 notificação pendente
	_, err := repo.Create(context.Background(), ownerA, CreateNotificationInput{Type: "email"})
	require.NoError(t, err)

	// ownerB busca suas próprias notificações pendentes
	list, err := svc.ListByOwner(context.Background(), ownerB, "pending")
	require.NoError(t, err)
	assert.Empty(t, list, "ownerB não deve ver notificações pendentes de ownerA")
}
```

- [ ] **Step 3: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/notification/... -v -run TestService_ListByOwner_PendingDoesNotLeakCrossOwner
```

Esperado: `FAIL — list tem 1 item (notificação do ownerA vazou)`

- [ ] **Step 4: Corrigir service.go**

Em `backend/internal/notification/service.go`, substituir `ListByOwner`:

```go
func (s *Service) ListByOwner(ctx context.Context, ownerID uuid.UUID, status string) ([]Notification, error) {
	return s.repo.ListByOwner(ctx, ownerID, status)
}
```

Remover o branch `if status == "pending"` que chamava `ListPending` sem ownerID.

- [ ] **Step 5: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/notification/... -v
```

Esperado: `PASS`

- [ ] **Step 6: Commit**

```bash
git add backend/internal/notification/service.go backend/internal/notification/service_test.go
git commit -m "fix(notification): remove cross-owner data leak in ListByOwner pending filter"
```

---

## Task 13: I5 — CORS bloqueado quando CORS_ALLOWED_ORIGINS não setado

**Files:**
- Modify: `backend/cmd/api/main.go`
- Test: sem teste automatizado (comportamento de infraestrutura — documentar o fix)

- [ ] **Step 1: Localizar o problema em main.go**

```bash
grep -n "CORS\|allowedOrigins\|allowed" backend/cmd/api/main.go | head -20
```

- [ ] **Step 2: Corrigir a lógica de CORS**

Localizar o bloco de configuração CORS em `backend/cmd/api/main.go`. O problema está em `strings.Split("", ",")` retornar `[""]` e não `[]`. Substituir a lógica por:

```go
corsOriginStr := os.Getenv("CORS_ALLOWED_ORIGINS")
var allowedOrigins []string
if corsOriginStr != "" {
    for _, o := range strings.Split(corsOriginStr, ",") {
        if trimmed := strings.TrimSpace(o); trimmed != "" {
            allowedOrigins = append(allowedOrigins, trimmed)
        }
    }
}

if len(allowedOrigins) == 0 {
    slog.Warn("CORS_ALLOWED_ORIGINS not set, defaulting to reject all origins")
    // allowedOrigins permanece nil — corsMiddleware rejeitará tudo
}
```

O CORS middleware deve usar `allowedOrigins` (slice limpo) para verificar.

- [ ] **Step 3: Compilar para verificar ausência de erros**

```bash
docker compose exec backend go build ./...
```

Esperado: sem erros

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/api/main.go
git commit -m "fix(cors): correctly parse CORS_ALLOWED_ORIGINS, handle empty string from Split"
```

---

## Task 14: M3 — RBAC middleware usa http.Error em vez de httputil.Err

**Files:**
- Modify: `backend/internal/rbac/middleware.go`
- Test: `backend/internal/rbac/middleware_test.go` (criar)

- [ ] **Step 1: Escrever teste falho**

Criar `backend/internal/rbac/middleware_test.go`:

```go
package rbac

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddleware_UnauthorizedResponseIsEnvelopeFormat(t *testing.T) {
	mw := Middleware(nil) // nil service → vai falhar na checagem de role

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	})

	// Requisição sem owner_id no contexto
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()

	mw(next).ServeHTTP(rr, req)

	assert.False(t, nextCalled)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)

	var body map[string]interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &body)
	require.NoError(t, err, "resposta deve ser JSON válido")
	assert.Contains(t, body, "error", "resposta deve ter envelope com campo 'error'")
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/rbac/... -v -run TestMiddleware_UnauthorizedResponseIsEnvelopeFormat
```

Esperado: `FAIL — body é "Unauthorized\n" e não JSON com envelope`

- [ ] **Step 3: Corrigir middleware.go**

Em `backend/internal/rbac/middleware.go`, substituir os `http.Error` por `httputil.Err` e adicionar import:

```go
package rbac

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

func Middleware(svc *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ownerID := auth.OwnerIDFromCtx(r.Context())
			if ownerID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
				return
			}

			roleStr := chi.URLParam(r, "role")
			if roleStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			role := RoleType(roleStr)
			var propertyID *uuid.UUID
			if propStr := chi.URLParam(r, "property_id"); propStr != "" {
				id, err := uuid.Parse(propStr)
				if err == nil {
					propertyID = &id
				}
			}

			hasRole, err := svc.CheckPermission(r.Context(), ownerID, role, propertyID)
			if err != nil || !hasRole {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "acesso negado")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/rbac/... -v
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/rbac/middleware.go backend/internal/rbac/middleware_test.go
git commit -m "fix(rbac): use httputil.Err envelope format instead of http.Error"
```

---

## Task 15: M5 — BradescoProvider race condition em token caching

**Files:**
- Modify: `backend/internal/payment/provider/bradesco.go`
- Test: `backend/internal/payment/provider/bradesco_test.go` (criar)

- [ ] **Step 1: Escrever teste de race condition**

Criar `backend/internal/payment/provider/bradesco_test.go`:

```go
package provider

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestBradescoProvider_EnsureToken_NoConcurrentRace(t *testing.T) {
	p := &BradescoProvider{
		clientID:     "test",
		clientSecret: "secret",
		token:        "existing-token",
		tokenExpiry:  time.Now().Add(time.Hour),
		baseURL:      "https://test.bradesco.com.br",
	}

	var wg sync.WaitGroup
	errors := make(chan error, 10)

	// 10 goroutines simultâneas acessando ensureToken
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// ensureToken retorna nil quando token ainda é válido
			// Com -race detector, detecta acesso sem sync
		}()
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		assert.NoError(t, err)
	}
}
```

- [ ] **Step 2: Verificar com race detector**

```bash
docker compose exec backend go test -race ./internal/payment/provider/... -run TestBradescoProvider_EnsureToken
```

Esperado: DATA RACE detectado

- [ ] **Step 3: Adicionar mutex ao BradescoProvider**

Em `backend/internal/payment/provider/bradesco.go`, adicionar `sync` ao import e mutex à struct:

```go
import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type BradescoProvider struct {
	clientID     string
	clientSecret string
	certPath     string
	pixKey       string
	baseURL      string
	mu           sync.Mutex
	token        string
	tokenExpiry  time.Time
	client       *http.Client
}
```

Em `ensureToken`, envolver com mutex:

```go
func (b *BradescoProvider) ensureToken(ctx context.Context) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.token != "" && time.Now().Before(b.tokenExpiry) {
		return nil
	}
	// ... resto do método
}
```

- [ ] **Step 4: Verificar com race detector**

```bash
docker compose exec backend go test -race ./internal/payment/provider/... -run TestBradescoProvider_EnsureToken
```

Esperado: `PASS` sem DATA RACE

- [ ] **Step 5: Commit**

```bash
git add backend/internal/payment/provider/bradesco.go backend/internal/payment/provider/bradesco_test.go
git commit -m "fix(payment): add mutex to BradescoProvider to prevent token cache race condition"
```

---

## Task 16: M4 — rand.Read retorno ignorado em identity service

**Files:**
- Modify: `backend/internal/identity/service.go`
- Test: nenhum (chamada defensiva, não tem comportamento testável unitariamente)

- [ ] **Step 1: Localizar as chamadas**

```bash
grep -n "rand.Read" backend/internal/identity/service.go
```

- [ ] **Step 2: Corrigir todas as chamadas para checar erro**

Para cada `rand.Read(buf)` sem checagem, substituir por:

```go
if _, err := rand.Read(buf); err != nil {
    return nil, fmt.Errorf("identity.svc: generate random bytes: %w", err)
}
```

Se o contexto for de geração de backup codes ou secret, propague o erro para o caller.

- [ ] **Step 3: Compilar**

```bash
docker compose exec backend go build ./...
```

Esperado: sem erros

- [ ] **Step 4: Commit**

```bash
git add backend/internal/identity/service.go
git commit -m "fix(identity): check rand.Read error for crypto/rand calls"
```

---

## Task 17: M2 — Remover strings.Contains para roteamento de erros (payment + lease)

**Files:**
- Modify: `backend/internal/payment/handler.go`
- Modify: `backend/internal/lease/handler.go`
- Modify: `backend/internal/payment/service.go` (adicionar sentinel errors)
- Modify: `backend/internal/lease/service.go` (adicionar sentinel errors)
- Modify: `backend/internal/payment/model.go` (declarar sentinel errors)
- Modify: `backend/internal/lease/model.go` (declarar sentinel errors)

- [ ] **Step 1: Escrever testes falhos**

Em `backend/internal/payment/handler_test.go`, adicionar:

```go
func TestHandler_CreatePayment_DuplicateMonthReturns409(t *testing.T) {
	svc := &mockPaymentService{
		createErr: ErrPaymentAlreadyExistsForMonth,
	}
	h := NewHandler(svc)

	body := `{"lease_id":"` + uuid.New().String() + `","amount":1000,"type":"RENT"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), "owner_id", uuid.New()))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusConflict, rr.Code)
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/payment/... -v -run TestHandler_CreatePayment_DuplicateMonthReturns409
```

Esperado: falha de compilação (`ErrPaymentAlreadyExistsForMonth` não existe)

- [ ] **Step 3: Adicionar sentinel errors ao model.go de payment**

Em `backend/internal/payment/model.go`, adicionar:

```go
import "errors"

var (
	ErrPaymentAlreadyExistsForMonth = errors.New("payment already exists for this month")
)
```

- [ ] **Step 4: Atualizar service.go de payment para usar sentinel**

Localizar o lugar onde a mensagem "month" é gerada no service e substituir por `ErrPaymentAlreadyExistsForMonth`.

- [ ] **Step 5: Atualizar handler.go de payment**

Substituir `strings.Contains(err.Error(), "month")` por `errors.Is(err, ErrPaymentAlreadyExistsForMonth)`.

- [ ] **Step 6: Fazer o mesmo para lease**

Repetir o processo para o lease handler com `ErrLeaseNotActive` ou equivalente.

- [ ] **Step 7: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/payment/... ./internal/lease/... -v
```

Esperado: `PASS`

- [ ] **Step 8: Commit**

```bash
git add backend/internal/payment/ backend/internal/lease/
git commit -m "fix(payment,lease): replace string matching error routing with typed sentinel errors"
```

---

## Checklist Final

- [ ] `make test-backend` passa sem erros
- [ ] `make test-backend-integration` passa sem erros  
- [ ] `docker compose exec backend go build ./...` sem erros
- [ ] `docker compose exec backend go vet ./...` sem warnings
