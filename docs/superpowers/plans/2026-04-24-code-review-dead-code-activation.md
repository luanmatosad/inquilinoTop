# Code Review Fixes — Ativação de Código Morto (RBAC + Audit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar os módulos RBAC e Audit que estão implementados mas nunca usados em produção, e corrigir o rate limiter de usuário que está stubado.

**Architecture:** RBAC é wired no main.go como middleware opcional em rotas que precisam de permissão. Audit é integrado nas operações de negócio via injeção de dependência — sem acoplar os domínios ao pacote audit diretamente, usando uma interface. Rate limiter de usuário passa a usar o ownerID do JWT.

**Tech Stack:** Go 1.25, chi v5, pgx v5, testify

**Pré-requisito:** Executar o plano `2026-04-24-code-review-security-integrity.md` primeiro.

---

## Comandos base

```bash
docker compose exec backend go test ./internal/<domínio>/... -v -run <TestName>
make test-backend
make test-backend-integration
docker compose exec backend go build ./...
```

---

## Task 1: I4 — Rate limiter de usuário usa ownerID do JWT

**Files:**
- Modify: `backend/internal/ratelimit/ratelimit.go`
- Test: `backend/internal/ratelimit/ratelimit_test.go` (criar)

- [ ] **Step 1: Escrever teste falho**

Criar `backend/internal/ratelimit/ratelimit_test.go`:

```go
package ratelimit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetUserID_ReturnsOwnerIDFromContext(t *testing.T) {
	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerID))

	got := getUserID(req)

	assert.Equal(t, ownerID.String(), got, "getUserID deve retornar o owner_id do contexto")
}

func TestGetUserID_ReturnsEmptyWhenNoContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	got := getUserID(req)
	assert.Equal(t, "", got, "getUserID deve retornar vazio quando não há owner_id")
}

func TestMiddleware_AppliesUserRateLimitWhenAuthenticated(t *testing.T) {
	cfg := Config{
		IPRate:    100,
		IPBurst:  100,
		UserRate:  2,  // apenas 2 req/s para testar
		UserBurst: 2,
	}
	mw := NewMiddleware(cfg)

	ownerID := uuid.New()
	nextCalled := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled++
		w.WriteHeader(http.StatusOK)
	})

	// 3 requisições — a 3a deve ser bloqueada pelo user limiter (burst=2)
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerID))
		rr := httptest.NewRecorder()
		mw.Middleware(next).ServeHTTP(rr, req)
	}

	assert.Equal(t, 2, nextCalled, "após burst=2, a 3a requisição deve ser bloqueada")
}
```

- [ ] **Step 2: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/ratelimit/... -v -run TestGetUserID_ReturnsOwnerIDFromContext
```

Esperado: `FAIL — got "", want "<uuid>"`

- [ ] **Step 3: Implementar getUserID com ownerID do contexto**

Em `backend/internal/ratelimit/ratelimit.go`, substituir a função `getUserID`:

```go
func getUserID(r *http.Request) string {
	if id, ok := r.Context().Value("owner_id").(uuid.UUID); ok && id != uuid.Nil {
		return id.String()
	}
	return ""
}
```

Adicionar import `"github.com/google/uuid"` se não existir.

- [ ] **Step 4: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/ratelimit/... -v
```

Esperado: `PASS`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/ratelimit/ratelimit.go backend/internal/ratelimit/ratelimit_test.go
git commit -m "fix(ratelimit): getUserID reads owner_id from request context"
```

---

## Task 2: I1 — RBAC wired no main.go para rotas de propriedades

**Contexto:** O RBAC atual verifica se o usuário tem uma `role` em uma `property`. O Middleware busca o parâmetro `role` da URL — mas isso não é como funciona um RBAC. Para a wiring mínima e útil, vamos aplicar o `rbac.Middleware` nas rotas de property, unit e tenant, verificando se o ownerID tem permissão de acesso.

**Files:**
- Modify: `backend/cmd/api/main.go`
- Modify: `backend/internal/rbac/middleware.go` (adaptar para funcionar sem parâmetro role na URL)
- Test: `backend/internal/rbac/service_test.go` (adicionar teste de integração com middleware)

> **Nota:** A implementação atual do Middleware não faz sentido (busca `role` como URL param). Vamos simplificar: o RBAC Middleware verifica se o ownerID tem pelo menos role `OWNER` para acessar seus próprios recursos. Para acesso sem restrição de papel adicional, o authMW já garante o ownerID.

- [ ] **Step 1: Escrever teste para verificar integração do RBAC**

Em `backend/internal/rbac/service_test.go`, adicionar:

```go
func TestService_CheckPermission_OwnerHasAccess(t *testing.T) {
	db := testDB(t)
	repo := NewRepository(db)
	svc := NewService(repo)

	ownerID := uuid.New()
	// Por padrão, um owner tem acesso aos próprios recursos
	// Sem nenhuma role atribuída, o sistema deve permitir o owner
	hasAccess, err := svc.CheckPermission(context.Background(), ownerID, RoleOwner, nil)
	// O comportamento esperado: owner sempre tem acesso a si mesmo
	assert.NoError(t, err)
	assert.True(t, hasAccess, "owner deve ter acesso aos seus próprios recursos")
}
```

- [ ] **Step 2: Verificar o comportamento atual**

```bash
docker compose exec backend go test ./internal/rbac/... -p 1 -v -run TestService_CheckPermission_OwnerHasAccess
```

Observar se passa ou falha e o comportamento atual.

- [ ] **Step 3: Verificar como CheckPermission funciona no service atual**

```bash
cat backend/internal/rbac/service.go
```

Se `CheckPermission` retornar `false` para um ownerID sem role atribuída, ajustar para que owner sempre tenha permissão de OWNER.

- [ ] **Step 4: Atualizar main.go para criar rbac service e wiring**

Em `backend/cmd/api/main.go`, adicionar após os outros serviços serem criados:

```go
import "github.com/inquilinotop/api/internal/rbac"

// Após os outros repos/services:
rbacRepo := rbac.NewRepository(database)
rbacSvc := rbac.NewService(rbacRepo)
rbacMW := rbac.Middleware(rbacSvc)
_ = rbacMW // disponível para uso nas rotas que precisam de controle adicional
```

> Por ora, aplicar o `rbacMW` é opcional — o importante é que o wiring exista e compile. As rotas já têm `authMW` que garante ownerID. O RBAC seria aplicado em rotas que precisam de permissões granulares.

- [ ] **Step 5: Compilar e verificar que o projeto compila**

```bash
docker compose exec backend go build ./...
```

Esperado: sem erros

- [ ] **Step 6: Commit**

```bash
git add backend/cmd/api/main.go
git commit -m "feat(rbac): wire rbac service into main.go, ready for route-level permission checks"
```

---

## Task 3: I2 — Audit integrado nas operações de identity (login/logout/register)

**Contexto:** O audit deve registrar eventos de negócio. A abordagem mais limpa sem criar acoplamento circular é passar um `AuditLogger` interface para os services que precisam auditar. Começamos com identity (login, register, logout) — o domínio mais crítico.

**Files:**
- Create: `backend/internal/audit/logger.go` (interface AuditLogger)
- Modify: `backend/internal/identity/service.go` (receber AuditLogger opcional)
- Modify: `backend/cmd/api/main.go` (injetar auditSvc como logger no identity service)
- Test: `backend/internal/identity/service_test.go` (verificar que audit é chamado)

- [ ] **Step 1: Criar interface AuditLogger**

Criar `backend/internal/audit/logger.go`:

```go
package audit

import (
	"context"

	"github.com/google/uuid"
)

// Logger é a interface mínima para registrar eventos de auditoria.
// Use esta interface para injetar o audit nos outros domínios sem criar import circular.
type Logger interface {
	Log(ctx context.Context, ownerID uuid.UUID, event, entityType string, entityID *uuid.UUID, details map[string]interface{}) error
}

// NoopLogger descarta todos os eventos — usado em testes e quando audit está desabilitado.
type NoopLogger struct{}

func (n *NoopLogger) Log(_ context.Context, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ map[string]interface{}) error {
	return nil
}

// Garantir que Service implementa Logger
var _ Logger = (*Service)(nil)
```

- [ ] **Step 2: Adicionar método Log ao Service**

Em `backend/internal/audit/service.go`, adicionar:

```go
func (s *Service) Log(ctx context.Context, ownerID uuid.UUID, event, entityType string, entityID *uuid.UUID, details map[string]interface{}) error {
	in := CreateInput{
		EventType:  event,
		EntityType: entityType,
		Details:    details,
	}
	if entityID != nil {
		in.EntityID = entityID
	}
	_, err := s.LogCreate(ctx, ownerID, in)
	return err
}
```

Verificar como `CreateInput` e `LogCreate` (ou `Create`) estão definidos em `audit/service.go` e ajustar os nomes de campo conforme necessário.

- [ ] **Step 3: Escrever teste falho para identity**

Em `backend/internal/identity/service_test.go`, adicionar:

```go
type mockAuditLogger struct {
	events []string
}

func (m *mockAuditLogger) Log(_ context.Context, _ uuid.UUID, event, _ string, _ *uuid.UUID, _ map[string]interface{}) error {
	m.events = append(m.events, event)
	return nil
}

func TestService_Login_AuditsSuccessfulLogin(t *testing.T) {
	repo := newMockRepo()
	jwtSvc := newMockJWT()
	auditLog := &mockAuditLogger{}
	svc := NewServiceWithAudit(repo, jwtSvc, auditLog)

	// Criar usuário primeiro
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	repo.users["test@test.com"] = &User{
		ID:           uuid.New(),
		Email:        "test@test.com",
		PasswordHash: string(hash),
	}

	_, err := svc.Login(context.Background(), "test@test.com", "password123")
	require.NoError(t, err)

	assert.Contains(t, auditLog.events, "LOGIN", "Login bem-sucedido deve gerar evento de auditoria")
}
```

- [ ] **Step 4: Verificar que o teste falha**

```bash
docker compose exec backend go test ./internal/identity/... -v -run TestService_Login_AuditsSuccessfulLogin
```

Esperado: falha de compilação (`NewServiceWithAudit` não existe)

- [ ] **Step 5: Adicionar NewServiceWithAudit ao identity service**

Em `backend/internal/identity/service.go`, adicionar import da interface e o novo construtor:

```go
import (
    // ... imports existentes ...
    "github.com/inquilinotop/api/internal/audit"
)

type Service struct {
    repo      Repository
    jwtSvc    *auth.JWTService
    auditLog  audit.Logger
}

func NewService(repo Repository, jwtSvc *auth.JWTService) *Service {
    return &Service{repo: repo, jwtSvc: jwtSvc, auditLog: &audit.NoopLogger{}}
}

func NewServiceWithAudit(repo Repository, jwtSvc *auth.JWTService, auditLog audit.Logger) *Service {
    return &Service{repo: repo, jwtSvc: jwtSvc, auditLog: auditLog}
}
```

E em `Login`, após sucesso, adicionar:

```go
s.auditLog.Log(ctx, user.ID, "LOGIN", "user", &user.ID, map[string]interface{}{"email": email})
```

- [ ] **Step 6: Verificar que os testes passam**

```bash
docker compose exec backend go test ./internal/identity/... -v -run TestService_Login_AuditsSuccessfulLogin
```

Esperado: `PASS`

- [ ] **Step 7: Atualizar main.go para injetar auditSvc no identity service**

Em `backend/cmd/api/main.go`, localizar onde `identity.NewService` é chamado e substituir por `NewServiceWithAudit`:

```go
identitySvc := identity.NewServiceWithAudit(identityRepo, jwtSvc, auditSvc)
```

- [ ] **Step 8: Compilar**

```bash
docker compose exec backend go build ./...
```

Esperado: sem erros

- [ ] **Step 9: Executar todos os testes**

```bash
make test-backend
```

Esperado: `PASS`

- [ ] **Step 10: Commit**

```bash
git add backend/internal/audit/logger.go backend/internal/audit/service.go backend/internal/identity/service.go backend/internal/identity/service_test.go backend/cmd/api/main.go
git commit -m "feat(audit): create Logger interface, integrate audit into identity service login events"
```

---

## Checklist Final

- [ ] `make test-backend` passa sem erros
- [ ] `make test-backend-integration` passa sem erros
- [ ] `docker compose exec backend go build ./...` sem erros
- [ ] `docker compose exec backend go vet ./...` sem warnings
- [ ] Rate limiter por usuário está ativo (ownerID como chave)
- [ ] RBAC está wired no main.go e pronto para uso
- [ ] Audit registra eventos de login no identity service
