# Backend Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o backend Go com auth próprio (JWT RS256), domínios Property, Unit e Tenant operacionais via REST API.

**Architecture:** Monólito modular em Go com padrão handler→service→repository por domínio. API HTTP via `chi`, banco PostgreSQL via `pgx`, autenticação JWT RS256 com refresh token. Backend vive em `backend/` dentro do repositório atual.

**Tech Stack:** Go 1.22+, chi v5, pgx v5, golang-jwt v5, golang-migrate v4, bcrypt, uuid, testify, httptest

---

## Mapa de Arquivos

```
backend/
├── cmd/api/
│   └── main.go                         ← entrypoint, wiring
├── internal/
│   ├── identity/
│   │   ├── model.go                    ← User, RefreshToken structs
│   │   ├── repository.go               ← interface + pgx impl
│   │   ├── repository_test.go          ← integration tests (real DB)
│   │   ├── service.go                  ← register, login, refresh, logout
│   │   ├── service_test.go             ← unit tests com mock repo
│   │   ├── handler.go                  ← HTTP handlers
│   │   └── handler_test.go             ← httptest handlers
│   ├── property/
│   │   ├── model.go
│   │   ├── repository.go
│   │   ├── repository_test.go
│   │   ├── service.go
│   │   ├── service_test.go
│   │   ├── handler.go
│   │   └── handler_test.go
│   └── tenant/
│       ├── model.go
│       ├── repository.go
│       ├── repository_test.go
│       ├── service.go
│       ├── service_test.go
│       ├── handler.go
│       └── handler_test.go
├── pkg/
│   ├── db/
│   │   ├── db.go                       ← pgxpool connection
│   │   └── migrate.go                  ← migration runner
│   ├── auth/
│   │   ├── jwt.go                      ← RS256 sign/verify, Claims
│   │   ├── jwt_test.go
│   │   └── middleware.go               ← chi middleware extrai owner_id
│   └── httputil/
│       ├── response.go                 ← JSON helpers (OK, Err)
│       └── response_test.go
├── migrations/
│   ├── 000001_create_users.up.sql
│   ├── 000001_create_users.down.sql
│   ├── 000002_create_refresh_tokens.up.sql
│   ├── 000002_create_refresh_tokens.down.sql
│   ├── 000003_create_properties.up.sql
│   ├── 000003_create_properties.down.sql
│   ├── 000004_create_units.up.sql
│   ├── 000004_create_units.down.sql
│   ├── 000005_create_tenants.up.sql
│   └── 000005_create_tenants.down.sql
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── go.mod
```

---

## Task 1: Scaffold do projeto Go

**Files:**
- Create: `backend/go.mod`
- Create: `backend/.env.example`

- [ ] **Step 1: Criar diretório e inicializar módulo**

```bash
mkdir -p backend && cd backend
go mod init github.com/inquilinotop/api
```

Expected: `backend/go.mod` criado com `module github.com/inquilinotop/api`

- [ ] **Step 2: Instalar dependências**

```bash
cd backend
go get github.com/go-chi/chi/v5@v5.1.0
go get github.com/jackc/pgx/v5@v5.6.0
go get github.com/golang-jwt/jwt/v5@v5.2.1
go get github.com/golang-migrate/migrate/v4@v4.17.1
go get github.com/golang-migrate/migrate/v4/database/postgres
go get github.com/golang-migrate/migrate/v4/source/file
go get golang.org/x/crypto@v0.23.0
go get github.com/google/uuid@v1.6.0
go get github.com/stretchr/testify@v1.9.0
```

- [ ] **Step 3: Criar .env.example**

```bash
cat > backend/.env.example << 'EOF'
DATABASE_URL=postgres://postgres:postgres@localhost:5432/inquilinotop?sslmode=disable
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
APP_ENV=development
PORT=8080
EOF
```

- [ ] **Step 4: Verificar compilação**

```bash
cd backend && go build ./...
```

Expected: sem erros (sem arquivos Go ainda, apenas go.mod)

- [ ] **Step 5: Commit**

```bash
git add backend/go.mod backend/go.sum backend/.env.example
git commit -m "feat(backend): inicializa módulo Go com dependências"
```

---

## Task 2: Docker Compose para desenvolvimento local

**Files:**
- Create: `backend/docker-compose.yml`

- [ ] **Step 1: Criar docker-compose.yml**

```yaml
# backend/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: inquilinotop
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  postgres_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: inquilinotop_test
    ports:
      - "5433:5432"

volumes:
  postgres_data:
```

- [ ] **Step 2: Subir banco e verificar**

```bash
cd backend && docker-compose up -d postgres postgres_test
docker-compose ps
```

Expected: ambos os serviços com status `healthy` / `Up`

- [ ] **Step 3: Commit**

```bash
git add backend/docker-compose.yml
git commit -m "feat(backend): adiciona docker-compose com postgres dev e test"
```

---

## Task 3: Pacote db — conexão e migrations

**Files:**
- Create: `backend/pkg/db/db.go`
- Create: `backend/pkg/db/migrate.go`

- [ ] **Step 1: Criar db.go**

```go
// backend/pkg/db/db.go
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*DB, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("db: ping: %w", err)
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Close() {
	d.Pool.Close()
}
```

- [ ] **Step 2: Criar migrate.go**

```go
// backend/pkg/db/migrate.go
package db

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(databaseURL, migrationsPath string) error {
	m, err := migrate.New("file://"+migrationsPath, databaseURL)
	if err != nil {
		return fmt.Errorf("migrate: init: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate: up: %w", err)
	}
	return nil
}
```

- [ ] **Step 3: Verificar compilação**

```bash
cd backend && go build ./pkg/db/...
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add backend/pkg/db/
git commit -m "feat(backend): adiciona pacote db com pool pgx e runner de migrations"
```

---

## Task 4: Pacote httputil — response helpers

**Files:**
- Create: `backend/pkg/httputil/response.go`
- Create: `backend/pkg/httputil/response_test.go`

- [ ] **Step 1: Escrever o teste**

```go
// backend/pkg/httputil/response_test.go
package httputil_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/stretchr/testify/assert"
)

func TestOK(t *testing.T) {
	w := httptest.NewRecorder()
	httputil.OK(w, map[string]string{"id": "123"})

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NotNil(t, resp["data"])
	assert.Nil(t, resp["error"])
}

func TestErr(t *testing.T) {
	w := httptest.NewRecorder()
	httputil.Err(w, http.StatusBadRequest, "INVALID_INPUT", "campo inválido")

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Nil(t, resp["data"])
	assert.NotNil(t, resp["error"])
	errObj := resp["error"].(map[string]interface{})
	assert.Equal(t, "INVALID_INPUT", errObj["code"])
}
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && go test ./pkg/httputil/...
```

Expected: FAIL — `httputil` package not found

- [ ] **Step 3: Implementar response.go**

```go
// backend/pkg/httputil/response.go
package httputil

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	Data  any        `json:"data"`
	Error *apiError  `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func OK(w http.ResponseWriter, data any) {
	write(w, http.StatusOK, envelope{Data: data})
}

func Created(w http.ResponseWriter, data any) {
	write(w, http.StatusCreated, envelope{Data: data})
}

func Err(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{Error: &apiError{Code: code, Message: message}})
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
```

- [ ] **Step 4: Rodar e confirmar aprovação**

```bash
cd backend && go test ./pkg/httputil/... -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/pkg/httputil/
git commit -m "feat(backend): adiciona helpers de resposta JSON padronizada"
```

---

## Task 5: Pacote auth — JWT RS256

**Files:**
- Create: `backend/pkg/auth/jwt.go`
- Create: `backend/pkg/auth/jwt_test.go`
- Create: `backend/keys/` (gerado, não commitado)

- [ ] **Step 1: Gerar par de chaves RSA para desenvolvimento**

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
echo "keys/*.pem" >> backend/.gitignore
```

- [ ] **Step 2: Escrever teste**

```go
// backend/pkg/auth/jwt_test.go
package auth_test

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func loadKeys(t *testing.T) (*rsa.PrivateKey, *rsa.PublicKey) {
	t.Helper()
	privBytes, err := os.ReadFile("../../keys/private.pem")
	require.NoError(t, err)
	block, _ := pem.Decode(privBytes)
	privKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	require.NoError(t, err)
	return privKey, &privKey.PublicKey
}

func TestSignAndVerify(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, err := svc.Sign(ownerID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := svc.Verify(token)
	require.NoError(t, err)
	assert.Equal(t, ownerID, claims.OwnerID)
}

func TestVerify_ExpiredToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	svc := auth.NewJWTService(privKey, pubKey, -1*time.Second)

	token, _ := svc.Sign(uuid.New())
	_, err := svc.Verify(token)
	assert.Error(t, err)
}
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
cd backend && go test ./pkg/auth/...
```

Expected: FAIL — `auth` package not found

- [ ] **Step 4: Implementar jwt.go**

```go
// backend/pkg/auth/jwt.go
package auth

import (
	"crypto/rsa"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	OwnerID uuid.UUID `json:"owner_id"`
	jwt.RegisteredClaims
}

type JWTService struct {
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	expiry     time.Duration
}

func NewJWTService(priv *rsa.PrivateKey, pub *rsa.PublicKey, expiry time.Duration) *JWTService {
	return &JWTService{privateKey: priv, publicKey: pub, expiry: expiry}
}

func (s *JWTService) Sign(ownerID uuid.UUID) (string, error) {
	claims := Claims{
		OwnerID: ownerID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(s.privateKey)
	if err != nil {
		return "", fmt.Errorf("jwt: sign: %w", err)
	}
	return signed, nil
}

func (s *JWTService) Verify(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("jwt: unexpected signing method")
		}
		return s.publicKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("jwt: verify: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("jwt: invalid claims")
	}
	return claims, nil
}
```

- [ ] **Step 5: Rodar e confirmar aprovação**

```bash
cd backend && go test ./pkg/auth/... -v
```

Expected: PASS (2 testes)

- [ ] **Step 6: Commit**

```bash
git add backend/pkg/auth/jwt.go backend/pkg/auth/jwt_test.go backend/.gitignore
git commit -m "feat(backend): adiciona serviço JWT RS256 com sign e verify"
```

---

## Task 6: Auth middleware

**Files:**
- Create: `backend/pkg/auth/middleware.go`

- [ ] **Step 1: Escrever teste**

Adicionar ao `backend/pkg/auth/jwt_test.go`:

```go
func TestMiddleware_ValidToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := jwtSvc.Sign(ownerID)

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		got := auth.OwnerIDFromCtx(r.Context())
		assert.Equal(t, ownerID, got)
		w.WriteHeader(http.StatusOK)
	})

	mw := auth.Middleware(jwtSvc)
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	mw(next).ServeHTTP(w, req)

	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddleware_NoToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	mw := auth.Middleware(jwtSvc)
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})).ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
```

Adicionar imports necessários ao arquivo:
```go
import (
    // existentes...
    "net/http"
    "net/http/httptest"
)
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && go test ./pkg/auth/... -run TestMiddleware
```

Expected: FAIL — `Middleware` not defined

- [ ] **Step 3: Implementar middleware.go**

```go
// backend/pkg/auth/middleware.go
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/httputil"
)

type contextKey string

const ownerIDKey contextKey = "owner_id"

func Middleware(svc *JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httputil.Err(w, http.StatusUnauthorized, "MISSING_TOKEN", "token não fornecido")
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := svc.Verify(tokenStr)
			if err != nil {
				httputil.Err(w, http.StatusUnauthorized, "INVALID_TOKEN", "token inválido ou expirado")
				return
			}
			ctx := context.WithValue(r.Context(), ownerIDKey, claims.OwnerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OwnerIDFromCtx(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(ownerIDKey).(uuid.UUID)
	return id
}
```

- [ ] **Step 4: Rodar todos os testes de auth**

```bash
cd backend && go test ./pkg/auth/... -v
```

Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/pkg/auth/middleware.go backend/pkg/auth/jwt_test.go
git commit -m "feat(backend): adiciona middleware JWT com extração de owner_id"
```

---

## Task 7: Migrations — users, refresh_tokens

**Files:**
- Create: `backend/migrations/000001_create_users.up.sql`
- Create: `backend/migrations/000001_create_users.down.sql`
- Create: `backend/migrations/000002_create_refresh_tokens.up.sql`
- Create: `backend/migrations/000002_create_refresh_tokens.down.sql`

- [ ] **Step 1: Criar migrations de users**

```sql
-- backend/migrations/000001_create_users.up.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'FREE',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

```sql
-- backend/migrations/000001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

- [ ] **Step 2: Criar migrations de refresh_tokens**

```sql
-- backend/migrations/000002_create_refresh_tokens.up.sql
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

```sql
-- backend/migrations/000002_create_refresh_tokens.down.sql
DROP TABLE IF EXISTS refresh_tokens;
```

- [ ] **Step 3: Testar execução das migrations**

```bash
cd backend
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/inquilinotop?sslmode=disable"
go run -e "
package main
import (
    \"context\"
    \"log\"
    \"os\"
    \"github.com/inquilinotop/api/pkg/db\"
)
func main() {
    if err := db.RunMigrations(os.Getenv(\"DATABASE_URL\"), \"./migrations\"); err != nil {
        log.Fatal(err)
    }
    log.Println(\"migrations OK\")
}
"
```

Alternativa mais simples para verificar:
```bash
cd backend
go build -o /tmp/migrate_test ./pkg/db/ 2>&1 && echo "compile OK"
```

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/
git commit -m "feat(backend): adiciona migrations para users e refresh_tokens"
```

---

## Task 8: Identity — model e repository

**Files:**
- Create: `backend/internal/identity/model.go`
- Create: `backend/internal/identity/repository.go`
- Create: `backend/internal/identity/repository_test.go`

- [ ] **Step 1: Criar model.go**

```go
// backend/internal/identity/model.go
package identity

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Plan         string    `json:"plan"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Repository interface {
	CreateUser(email, passwordHash string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error)
	GetRefreshToken(tokenHash string) (*RefreshToken, error)
	RevokeRefreshToken(tokenHash string) error
}
```

- [ ] **Step 2: Escrever teste de repositório (integration)**

```go
// backend/internal/identity/repository_test.go
package identity_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/identity"
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
	require.NoError(t, db.RunMigrations(url, "../../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users, refresh_tokens CASCADE")
		d.Close()
	})
	return d
}

func TestRepository_CreateAndGetUser(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser("test@example.com", "hash123")
	require.NoError(t, err)
	assert.NotEmpty(t, user.ID)
	assert.Equal(t, "test@example.com", user.Email)

	found, err := repo.GetUserByEmail("test@example.com")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.ID)
}

func TestRepository_CreateRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser("rt@example.com", "hash")
	rt, err := repo.CreateRefreshToken(user.ID, "tokenHash123", time.Now().Add(30*24*time.Hour))
	require.NoError(t, err)
	assert.NotEmpty(t, rt.ID)

	found, err := repo.GetRefreshToken("tokenHash123")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.UserID)
}

func TestRepository_RevokeRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser("rev@example.com", "hash")
	repo.CreateRefreshToken(user.ID, "revokeMe", time.Now().Add(time.Hour))

	err := repo.RevokeRefreshToken("revokeMe")
	require.NoError(t, err)

	rt, _ := repo.GetRefreshToken("revokeMe")
	assert.NotNil(t, rt.RevokedAt)
}
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
cd backend && go test ./internal/identity/... -run TestRepository
```

Expected: FAIL — `NewRepository` not defined

- [ ] **Step 4: Implementar repository.go**

```go
// backend/internal/identity/repository.go
package identity

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) CreateUser(email, passwordHash string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, password_hash, plan, created_at, updated_at`,
		email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: create user: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByEmail(email string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, email, password_hash, plan, created_at, updated_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by email: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByID(id uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, email, password_hash, plan, created_at, updated_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by id: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at`,
		userID, tokenHash, expiresAt,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: create refresh token: %w", err)
	}
	return &rt, nil
}

func (r *pgRepository) GetRefreshToken(tokenHash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get refresh token: %w", err)
	}
	return &rt, nil
}

func (r *pgRepository) RevokeRefreshToken(tokenHash string) error {
	now := time.Now()
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2`,
		now, tokenHash,
	)
	if err != nil {
		return fmt.Errorf("identity.repo: revoke refresh token: %w", err)
	}
	return nil
}
```

- [ ] **Step 5: Rodar e confirmar aprovação**

```bash
cd backend && go test ./internal/identity/... -run TestRepository -v
```

Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add backend/internal/identity/
git commit -m "feat(backend): adiciona model e repository do domínio identity"
```

---

## Task 9: Identity — service (register, login, refresh, logout)

**Files:**
- Create: `backend/internal/identity/service.go`
- Create: `backend/internal/identity/service_test.go`

- [ ] **Step 1: Escrever testes do service**

```go
// backend/internal/identity/service_test.go
package identity_test

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock do repositório
type mockRepo struct {
	users         map[string]*identity.User
	refreshTokens map[string]*identity.RefreshToken
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		users:         make(map[string]*identity.User),
		refreshTokens: make(map[string]*identity.RefreshToken),
	}
}

func (m *mockRepo) CreateUser(email, passwordHash string) (*identity.User, error) {
	if _, exists := m.users[email]; exists {
		return nil, errors.New("email já cadastrado")
	}
	u := &identity.User{ID: uuid.New(), Email: email, PasswordHash: passwordHash, Plan: "FREE"}
	m.users[email] = u
	return u, nil
}

func (m *mockRepo) GetUserByEmail(email string) (*identity.User, error) {
	u, ok := m.users[email]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockRepo) GetUserByID(id uuid.UUID) (*identity.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockRepo) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) (*identity.RefreshToken, error) {
	rt := &identity.RefreshToken{ID: uuid.New(), UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt}
	m.refreshTokens[tokenHash] = rt
	return rt, nil
}

func (m *mockRepo) GetRefreshToken(tokenHash string) (*identity.RefreshToken, error) {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return nil, errors.New("not found")
	}
	return rt, nil
}

func (m *mockRepo) RevokeRefreshToken(tokenHash string) error {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return errors.New("not found")
	}
	now := time.Now()
	rt.RevokedAt = &now
	return nil
}

func newTestService(t *testing.T) *identity.Service {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	return identity.NewService(newMockRepo(), jwtSvc)
}

func TestService_Register(t *testing.T) {
	svc := newTestService(t)
	result, err := svc.Register("user@test.com", "senha123")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.NotEmpty(t, result.RefreshToken)
	assert.NotEmpty(t, result.User.ID)
}

func TestService_Register_DuplicateEmail(t *testing.T) {
	svc := newTestService(t)
	svc.Register("dup@test.com", "senha123")
	_, err := svc.Register("dup@test.com", "outrasenha")
	assert.Error(t, err)
}

func TestService_Login(t *testing.T) {
	svc := newTestService(t)
	svc.Register("login@test.com", "minhasenha")
	result, err := svc.Login("login@test.com", "minhasenha")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}

func TestService_Login_WrongPassword(t *testing.T) {
	svc := newTestService(t)
	svc.Register("wp@test.com", "correta")
	_, err := svc.Login("wp@test.com", "errada")
	assert.Error(t, err)
}

func TestService_Refresh(t *testing.T) {
	svc := newTestService(t)
	reg, _ := svc.Register("refresh@test.com", "senha")
	result, err := svc.Refresh(reg.RefreshToken)
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && go test ./internal/identity/... -run TestService
```

Expected: FAIL — `identity.Service` not defined

- [ ] **Step 3: Implementar service.go**

```go
// backend/internal/identity/service.go
package identity

import (
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"golang.org/x/crypto/bcrypt"
)

type AuthResult struct {
	User         *User  `json:"user"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type Service struct {
	repo   Repository
	jwtSvc *auth.JWTService
}

func NewService(repo Repository, jwtSvc *auth.JWTService) *Service {
	return &Service{repo: repo, jwtSvc: jwtSvc}
}

func (s *Service) Register(email, password string) (*AuthResult, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: hash password: %w", err)
	}
	user, err := s.repo.CreateUser(email, string(hash))
	if err != nil {
		return nil, fmt.Errorf("identity.svc: create user: %w", err)
	}
	return s.issueTokens(user)
}

func (s *Service) Login(email, password string) (*AuthResult, error) {
	user, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
	}
	return s.issueTokens(user)
}

func (s *Service) Refresh(rawRefreshToken string) (*AuthResult, error) {
	hash := tokenHash(rawRefreshToken)
	rt, err := s.repo.GetRefreshToken(hash)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: refresh token inválido")
	}
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		return nil, fmt.Errorf("identity.svc: refresh token expirado ou revogado")
	}
	if err := s.repo.RevokeRefreshToken(hash); err != nil {
		return nil, fmt.Errorf("identity.svc: revogar token: %w", err)
	}
	user, err := s.repo.GetUserByID(rt.UserID)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: usuário não encontrado: %w", err)
	}
	return s.issueTokens(user)
}

func (s *Service) Logout(rawRefreshToken string) error {
	return s.repo.RevokeRefreshToken(tokenHash(rawRefreshToken))
}

func (s *Service) issueTokens(user *User) (*AuthResult, error) {
	accessToken, err := s.jwtSvc.Sign(user.ID)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: sign access token: %w", err)
	}
	raw := uuid.New().String()
	_, err = s.repo.CreateRefreshToken(user.ID, tokenHash(raw), time.Now().Add(30*24*time.Hour))
	if err != nil {
		return nil, fmt.Errorf("identity.svc: create refresh token: %w", err)
	}
	return &AuthResult{User: user, AccessToken: accessToken, RefreshToken: raw}, nil
}

func tokenHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum)
}
```

- [ ] **Step 4: Rodar e confirmar aprovação**

```bash
cd backend && go test ./internal/identity/... -run TestService -v
```

Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/internal/identity/service.go backend/internal/identity/service_test.go
git commit -m "feat(backend): adiciona service de identity com register/login/refresh/logout"
```

---

## Task 10: Identity — handler HTTP

**Files:**
- Create: `backend/internal/identity/handler.go`
- Create: `backend/internal/identity/handler_test.go`

- [ ] **Step 1: Escrever testes**

```go
// backend/internal/identity/handler_test.go
package identity_test

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestHandler(t *testing.T) (http.Handler, *identity.Service) {
	t.Helper()
	privKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	svc := identity.NewService(newMockRepo(), jwtSvc)
	h := identity.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r)
	return r, svc
}

func TestHandler_Register(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "h@test.com", "password": "senha123"})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	assert.NotEmpty(t, data["access_token"])
	assert.NotEmpty(t, data["refresh_token"])
}

func TestHandler_Login(t *testing.T) {
	router, svc := newTestHandler(t)
	svc.Register("login@test.com", "senha")

	body, _ := json.Marshal(map[string]string{"email": "login@test.com", "password": "senha"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandler_Login_InvalidCredentials(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "none@test.com", "password": "wrong"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && go test ./internal/identity/... -run TestHandler
```

Expected: FAIL — `NewHandler` not defined

- [ ] **Step 3: Implementar handler.go**

```go
// backend/internal/identity/handler.go
package identity

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router) {
	r.Post("/api/v1/auth/register", h.register)
	r.Post("/api/v1/auth/login", h.login)
	r.Post("/api/v1/auth/refresh", h.refresh)
	r.Post("/api/v1/auth/logout", h.logout)
}

type credentialsInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var in credentialsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if in.Email == "" || in.Password == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_FIELDS", "email e senha são obrigatórios")
		return
	}
	result, err := h.svc.Register(in.Email, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusConflict, "REGISTER_FAILED", err.Error())
		return
	}
	httputil.Created(w, result)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in credentialsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	result, err := h.svc.Login(in.Email, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "credenciais inválidas")
		return
	}
	httputil.OK(w, result)
}

type refreshInput struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var in refreshInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.RefreshToken == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_REFRESH_TOKEN", "refresh_token é obrigatório")
		return
	}
	result, err := h.svc.Refresh(in.RefreshToken)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", err.Error())
		return
	}
	httputil.OK(w, result)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var in refreshInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.RefreshToken == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_REFRESH_TOKEN", "refresh_token é obrigatório")
		return
	}
	h.svc.Logout(in.RefreshToken)
	httputil.OK(w, map[string]bool{"logged_out": true})
}
```

- [ ] **Step 4: Rodar todos os testes de identity**

```bash
cd backend && go test ./internal/identity/... -v
```

Expected: PASS (todos os testes, exceto os de repositório que precisam de DB rodando)

- [ ] **Step 5: Commit**

```bash
git add backend/internal/identity/handler.go backend/internal/identity/handler_test.go
git commit -m "feat(backend): adiciona handler HTTP do domínio identity"
```

---

## Task 11: Migrations — properties, units, tenants

**Files:**
- Create: `backend/migrations/000003_create_properties.up.sql`
- Create: `backend/migrations/000003_create_properties.down.sql`
- Create: `backend/migrations/000004_create_units.up.sql`
- Create: `backend/migrations/000004_create_units.down.sql`
- Create: `backend/migrations/000005_create_tenants.up.sql`
- Create: `backend/migrations/000005_create_tenants.down.sql`

- [ ] **Step 1: Migration de properties**

```sql
-- backend/migrations/000003_create_properties.up.sql
CREATE TABLE properties (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN ('RESIDENTIAL', 'SINGLE')),
    name         TEXT NOT NULL,
    address_line TEXT,
    city         TEXT,
    state        TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_owner_id ON properties(owner_id);
```

```sql
-- backend/migrations/000003_create_properties.down.sql
DROP TABLE IF EXISTS properties;
```

- [ ] **Step 2: Migration de units**

```sql
-- backend/migrations/000004_create_units.up.sql
CREATE TABLE units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    floor       TEXT,
    notes       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_units_property_id ON units(property_id);
```

```sql
-- backend/migrations/000004_create_units.down.sql
DROP TABLE IF EXISTS units;
```

- [ ] **Step 3: Migration de tenants**

```sql
-- backend/migrations/000005_create_tenants.up.sql
CREATE TABLE tenants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    document   TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_owner_id ON tenants(owner_id);
```

```sql
-- backend/migrations/000005_create_tenants.down.sql
DROP TABLE IF EXISTS tenants;
```

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/
git commit -m "feat(backend): adiciona migrations para properties, units e tenants"
```

---

## Task 12: Property — model, repository, service, handler

**Files:**
- Create: `backend/internal/property/model.go`
- Create: `backend/internal/property/repository.go`
- Create: `backend/internal/property/repository_test.go`
- Create: `backend/internal/property/service.go`
- Create: `backend/internal/property/service_test.go`
- Create: `backend/internal/property/handler.go`
- Create: `backend/internal/property/handler_test.go`

- [ ] **Step 1: Criar model.go**

```go
// backend/internal/property/model.go
package property

import (
	"time"

	"github.com/google/uuid"
)

type Property struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     uuid.UUID `json:"owner_id"`
	Type        string    `json:"type"`
	Name        string    `json:"name"`
	AddressLine *string   `json:"address_line,omitempty"`
	City        *string   `json:"city,omitempty"`
	State       *string   `json:"state,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Unit struct {
	ID         uuid.UUID `json:"id"`
	PropertyID uuid.UUID `json:"property_id"`
	Label      string    `json:"label"`
	Floor      *string   `json:"floor,omitempty"`
	Notes      *string   `json:"notes,omitempty"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreatePropertyInput struct {
	Type        string  `json:"type"`
	Name        string  `json:"name"`
	AddressLine *string `json:"address_line,omitempty"`
	City        *string `json:"city,omitempty"`
	State       *string `json:"state,omitempty"`
}

type CreateUnitInput struct {
	Label string  `json:"label"`
	Floor *string `json:"floor,omitempty"`
	Notes *string `json:"notes,omitempty"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	GetByID(id, ownerID uuid.UUID) (*Property, error)
	List(ownerID uuid.UUID) ([]Property, error)
	Update(id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	Delete(id, ownerID uuid.UUID) error
	CreateUnit(propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
	GetUnit(id uuid.UUID) (*Unit, error)
	ListUnits(propertyID uuid.UUID) ([]Unit, error)
	UpdateUnit(id uuid.UUID, in CreateUnitInput) (*Unit, error)
	DeleteUnit(id uuid.UUID) error
}
```

- [ ] **Step 2: Escrever teste do repository**

```go
// backend/internal/property/repository_test.go
package property_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
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
	require.NoError(t, db.RunMigrations(url, "../../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users, properties, units, tenants CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestRepository_CreateAndListProperties(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	name := "Edificio Central"
	p, err := repo.Create(ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: name})
	require.NoError(t, err)
	assert.Equal(t, name, p.Name)
	assert.Equal(t, ownerID, p.OwnerID)

	list, err := repo.List(ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestRepository_DeleteProperty_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(ownerID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	err := repo.Delete(p.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(ownerID)
	assert.Len(t, list, 0)
}

func TestRepository_CreateUnit(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	unit, err := repo.CreateUnit(p.ID, property.CreateUnitInput{Label: "Apt 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apt 101", unit.Label)
}
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
cd backend && go test ./internal/property/... -run TestRepository
```

Expected: FAIL — `NewRepository` not defined

- [ ] **Step 4: Implementar repository.go**

```go
// backend/internal/property/repository.go
package property

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name, address_line, city, state)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at`,
		ownerID, in.Type, in.Name, in.AddressLine, in.City, in.State,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at
		 FROM properties WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) List(ownerID uuid.UUID) ([]Property, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at
		 FROM properties WHERE owner_id=$1 AND is_active=true ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Property
	for rows.Next() {
		var p Property
		rows.Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
		list = append(list, p)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE properties SET type=$1, name=$2, address_line=$3, city=$4, state=$5, updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7 AND is_active=true
		 RETURNING id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at`,
		in.Type, in.Name, in.AddressLine, in.City, in.State, id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) Delete(id, ownerID uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE properties SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	return err
}

func (r *pgRepository) CreateUnit(propertyID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label, floor, notes) VALUES ($1,$2,$3,$4)
		 RETURNING id, property_id, label, floor, notes, is_active, created_at, updated_at`,
		propertyID, in.Label, in.Floor, in.Notes,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: create unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUnit(id uuid.UUID) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, property_id, label, floor, notes, is_active, created_at, updated_at
		 FROM units WHERE id=$1 AND is_active=true`,
		id,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: get unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) ListUnits(propertyID uuid.UUID) ([]Unit, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, property_id, label, floor, notes, is_active, created_at, updated_at
		 FROM units WHERE property_id=$1 AND is_active=true ORDER BY label`,
		propertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list units: %w", err)
	}
	defer rows.Close()
	var list []Unit
	for rows.Next() {
		var u Unit
		rows.Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
		list = append(list, u)
	}
	return list, nil
}

func (r *pgRepository) UpdateUnit(id uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE units SET label=$1, floor=$2, notes=$3, updated_at=NOW()
		 WHERE id=$4 AND is_active=true
		 RETURNING id, property_id, label, floor, notes, is_active, created_at, updated_at`,
		in.Label, in.Floor, in.Notes, id,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) DeleteUnit(id uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE units SET is_active=false, updated_at=NOW() WHERE id=$1`, id,
	)
	return err
}
```

- [ ] **Step 5: Implementar service.go**

```go
// backend/internal/property/service.go
package property

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateProperty(ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("property.svc: nome é obrigatório")
	}
	if in.Type != "RESIDENTIAL" && in.Type != "SINGLE" {
		return nil, fmt.Errorf("property.svc: tipo inválido")
	}
	p, err := s.repo.Create(ownerID, in)
	if err != nil {
		return nil, err
	}
	if in.Type == "SINGLE" {
		label := "Unidade 01"
		notes := "Unidade criada automaticamente"
		s.repo.CreateUnit(p.ID, CreateUnitInput{Label: label, Notes: &notes})
	}
	return p, nil
}

func (s *Service) GetProperty(id, ownerID uuid.UUID) (*Property, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListProperties(ownerID uuid.UUID) ([]Property, error) {
	return s.repo.List(ownerID)
}

func (s *Service) UpdateProperty(id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) DeleteProperty(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}

func (s *Service) CreateUnit(propertyID uuid.UUID, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	if _, err := s.repo.GetByID(propertyID, ownerID); err != nil {
		return nil, fmt.Errorf("property.svc: imóvel não encontrado ou sem permissão")
	}
	return s.repo.CreateUnit(propertyID, in)
}

func (s *Service) ListUnits(propertyID uuid.UUID) ([]Unit, error) {
	return s.repo.ListUnits(propertyID)
}

func (s *Service) UpdateUnit(id uuid.UUID, in CreateUnitInput) (*Unit, error) {
	return s.repo.UpdateUnit(id, in)
}

func (s *Service) DeleteUnit(id uuid.UUID) error {
	return s.repo.DeleteUnit(id)
}
```

- [ ] **Step 6: Escrever testes do service**

```go
// backend/internal/property/service_test.go
package property_test

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	properties map[uuid.UUID]*property.Property
	units      map[uuid.UUID]*property.Unit
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		properties: make(map[uuid.UUID]*property.Property),
		units:      make(map[uuid.UUID]*property.Unit),
	}
}

func (m *mockRepo) Create(ownerID uuid.UUID, in property.CreatePropertyInput) (*property.Property, error) {
	p := &property.Property{ID: uuid.New(), OwnerID: ownerID, Type: in.Type, Name: in.Name, IsActive: true}
	m.properties[p.ID] = p
	return p, nil
}

func (m *mockRepo) GetByID(id, ownerID uuid.UUID) (*property.Property, error) {
	p, ok := m.properties[id]
	if !ok || p.OwnerID != ownerID || !p.IsActive {
		return nil, errors.New("not found")
	}
	return p, nil
}

func (m *mockRepo) List(ownerID uuid.UUID) ([]property.Property, error) {
	var list []property.Property
	for _, p := range m.properties {
		if p.OwnerID == ownerID && p.IsActive {
			list = append(list, *p)
		}
	}
	return list, nil
}

func (m *mockRepo) Update(id, ownerID uuid.UUID, in property.CreatePropertyInput) (*property.Property, error) {
	p, err := m.GetByID(id, ownerID)
	if err != nil {
		return nil, err
	}
	p.Name = in.Name
	return p, nil
}

func (m *mockRepo) Delete(id, ownerID uuid.UUID) error {
	p, err := m.GetByID(id, ownerID)
	if err != nil {
		return err
	}
	p.IsActive = false
	return nil
}

func (m *mockRepo) CreateUnit(propertyID uuid.UUID, in property.CreateUnitInput) (*property.Unit, error) {
	u := &property.Unit{ID: uuid.New(), PropertyID: propertyID, Label: in.Label, IsActive: true}
	m.units[u.ID] = u
	return u, nil
}

func (m *mockRepo) GetUnit(id uuid.UUID) (*property.Unit, error) {
	u, ok := m.units[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockRepo) ListUnits(propertyID uuid.UUID) ([]property.Unit, error) {
	var list []property.Unit
	for _, u := range m.units {
		if u.PropertyID == propertyID && u.IsActive {
			list = append(list, *u)
		}
	}
	return list, nil
}

func (m *mockRepo) UpdateUnit(id uuid.UUID, in property.CreateUnitInput) (*property.Unit, error) {
	u, ok := m.units[id]
	if !ok {
		return nil, errors.New("not found")
	}
	u.Label = in.Label
	return u, nil
}

func (m *mockRepo) DeleteUnit(id uuid.UUID) error {
	u, ok := m.units[id]
	if !ok {
		return errors.New("not found")
	}
	u.IsActive = false
	return nil
}

func TestService_CreateSingleProperty_AutoCreatesUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, err := svc.CreateProperty(ownerID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	require.NoError(t, err)

	units, _ := svc.ListUnits(p.ID)
	assert.Len(t, units, 1)
	assert.Equal(t, "Unidade 01", units[0].Label)
}

func TestService_CreateProperty_InvalidType(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.CreateProperty(uuid.New(), property.CreatePropertyInput{Type: "INVALID", Name: "X"})
	assert.Error(t, err)
}

func TestService_DeleteProperty(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	err := svc.DeleteProperty(p.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.ListProperties(ownerID)
	assert.Len(t, list, 0)
}
```

- [ ] **Step 7: Implementar handler.go**

```go
// backend/internal/property/handler.go
package property

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/properties", h.list)
	r.With(authMW).Post("/api/v1/properties", h.create)
	r.With(authMW).Get("/api/v1/properties/{id}", h.get)
	r.With(authMW).Put("/api/v1/properties/{id}", h.update)
	r.With(authMW).Delete("/api/v1/properties/{id}", h.delete)
	r.With(authMW).Post("/api/v1/properties/{id}/units", h.createUnit)
	r.With(authMW).Get("/api/v1/units/{id}", h.getUnit)
	r.With(authMW).Put("/api/v1/units/{id}", h.updateUnit)
	r.With(authMW).Delete("/api/v1/units/{id}", h.deleteUnit)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.ListProperties(ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Property{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	var in CreatePropertyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	p, err := h.svc.CreateProperty(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, p)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	p, err := h.svc.GetProperty(id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "imóvel não encontrado")
		return
	}
	httputil.OK(w, p)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreatePropertyInput
	json.NewDecoder(r.Body).Decode(&in)
	p, err := h.svc.UpdateProperty(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteProperty(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

func (h *Handler) createUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	json.NewDecoder(r.Body).Decode(&in)
	u, err := h.svc.CreateUnit(propertyID, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.Created(w, u)
}

func (h *Handler) getUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	u, err := h.svc.GetUnit(id)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
		return
	}
	httputil.OK(w, u)
}

func (s *Service) GetUnit(id uuid.UUID) (*Unit, error) {
	return s.repo.GetUnit(id)
}

func (h *Handler) updateUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	json.NewDecoder(r.Body).Decode(&in)
	u, err := h.svc.UpdateUnit(id, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

func (h *Handler) deleteUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteUnit(id); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
```

- [ ] **Step 8: Rodar todos os testes de property**

```bash
cd backend && go test ./internal/property/... -v
```

Expected: PASS (testes de service; testes de repository requerem DB rodando)

- [ ] **Step 9: Commit**

```bash
git add backend/internal/property/
git commit -m "feat(backend): adiciona domínio property completo (CRUD properties + units)"
```

---

## Task 13: Tenant — model, repository, service, handler

**Files:**
- Create: `backend/internal/tenant/model.go`
- Create: `backend/internal/tenant/repository.go`
- Create: `backend/internal/tenant/repository_test.go`
- Create: `backend/internal/tenant/service.go`
- Create: `backend/internal/tenant/service_test.go`
- Create: `backend/internal/tenant/handler.go`

- [ ] **Step 1: Criar model.go**

```go
// backend/internal/tenant/model.go
package tenant

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID        uuid.UUID `json:"id"`
	OwnerID   uuid.UUID `json:"owner_id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email,omitempty"`
	Phone     *string   `json:"phone,omitempty"`
	Document  *string   `json:"document,omitempty"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateTenantInput struct {
	Name     string  `json:"name"`
	Email    *string `json:"email,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Document *string `json:"document,omitempty"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	GetByID(id, ownerID uuid.UUID) (*Tenant, error)
	List(ownerID uuid.UUID) ([]Tenant, error)
	Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	Delete(id, ownerID uuid.UUID) error
}
```

- [ ] **Step 2: Escrever teste do repository**

```go
// backend/internal/tenant/repository_test.go
package tenant_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
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
	require.NoError(t, db.RunMigrations(url, "../../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users, tenants CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-tenant@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestTenantRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := tenant.NewRepository(database)

	email := "joao@example.com"
	ten, err := repo.Create(ownerID, tenant.CreateTenantInput{Name: "João Silva", Email: &email})
	require.NoError(t, err)
	assert.Equal(t, "João Silva", ten.Name)

	list, err := repo.List(ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTenantRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := tenant.NewRepository(database)

	ten, _ := repo.Create(ownerID, tenant.CreateTenantInput{Name: "Maria"})
	err := repo.Delete(ten.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(ownerID)
	assert.Len(t, list, 0)
}
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
cd backend && go test ./internal/tenant/... -run TestTenantRepository
```

Expected: FAIL — `NewRepository` not defined

- [ ] **Step 4: Implementar repository.go**

```go
// backend/internal/tenant/repository.go
package tenant

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name, email, phone, document)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, owner_id, name, email, phone, document, is_active, created_at, updated_at`,
		ownerID, in.Name, in.Email, in.Phone, in.Document,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: create: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, name, email, phone, document, is_active, created_at, updated_at
		 FROM tenants WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: get by id: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) List(ownerID uuid.UUID) ([]Tenant, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, name, email, phone, document, is_active, created_at, updated_at
		 FROM tenants WHERE owner_id=$1 AND is_active=true ORDER BY name`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Tenant
	for rows.Next() {
		var t Tenant
		rows.Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
		list = append(list, t)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE tenants SET name=$1, email=$2, phone=$3, document=$4, updated_at=NOW()
		 WHERE id=$5 AND owner_id=$6 AND is_active=true
		 RETURNING id, owner_id, name, email, phone, document, is_active, created_at, updated_at`,
		in.Name, in.Email, in.Phone, in.Document, id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: update: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) Delete(id, ownerID uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE tenants SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	return err
}
```

- [ ] **Step 5: Implementar service.go**

```go
// backend/internal/tenant/service.go
package tenant

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("tenant.svc: nome é obrigatório")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Tenant, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) List(ownerID uuid.UUID) ([]Tenant, error) {
	return s.repo.List(ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}
```

- [ ] **Step 6: Implementar handler.go**

```go
// backend/internal/tenant/handler.go
package tenant

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/tenants", h.list)
	r.With(authMW).Post("/api/v1/tenants", h.create)
	r.With(authMW).Get("/api/v1/tenants/{id}", h.get)
	r.With(authMW).Put("/api/v1/tenants/{id}", h.update)
	r.With(authMW).Delete("/api/v1/tenants/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.List(ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Tenant{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	var in CreateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	t, err := h.svc.Create(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, t)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	t, err := h.svc.Get(id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "inquilino não encontrado")
		return
	}
	httputil.OK(w, t)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateTenantInput
	json.NewDecoder(r.Body).Decode(&in)
	t, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, t)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
```

- [ ] **Step 7: Rodar testes de tenant**

```bash
cd backend && go test ./internal/tenant/... -v
```

Expected: PASS (testes de service; repository testes requerem DB rodando)

- [ ] **Step 8: Commit**

```bash
git add backend/internal/tenant/
git commit -m "feat(backend): adiciona domínio tenant completo (CRUD)"
```

---

## Task 14: Entrypoint — main.go e health check

**Files:**
- Create: `backend/cmd/api/main.go`

- [ ] **Step 1: Implementar main.go**

```go
// backend/cmd/api/main.go
package main

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/inquilinotop/api/pkg/httputil"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	databaseURL := mustEnv("DATABASE_URL")
	database, err := db.New(context.Background(), databaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	migrationsPath := envOr("MIGRATIONS_PATH", "./migrations")
	if err := db.RunMigrations(databaseURL, migrationsPath); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	privKey := mustLoadPrivateKey(mustEnv("JWT_PRIVATE_KEY_PATH"))
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	authMW := auth.Middleware(jwtSvc)

	identityRepo := identity.NewRepository(database)
	identitySvc := identity.NewService(identityRepo, jwtSvc)
	identityHandler := identity.NewHandler(identitySvc)

	propertyRepo := property.NewRepository(database)
	propertySvc := property.NewService(propertyRepo)
	propertyHandler := property.NewHandler(propertySvc)

	tenantRepo := tenant.NewRepository(database)
	tenantSvc := tenant.NewService(tenantRepo)
	tenantHandler := tenant.NewHandler(tenantSvc)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := database.Pool.Ping(r.Context()); err != nil {
			httputil.Err(w, http.StatusServiceUnavailable, "DB_UNAVAILABLE", "banco indisponível")
			return
		}
		httputil.OK(w, map[string]string{"status": "ok"})
	})

	identityHandler.Register(r)
	propertyHandler.Register(r, authMW)
	tenantHandler.Register(r, authMW)

	port := envOr("PORT", "8080")
	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("missing required env var", "key", key)
		os.Exit(1)
	}
	return v
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustLoadPrivateKey(path string) *rsa.PrivateKey {
	data, err := os.ReadFile(path)
	if err != nil {
		slog.Error("failed to read private key", "path", path, "error", err)
		os.Exit(1)
	}
	block, _ := pem.Decode(data)
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		slog.Error("failed to parse private key", "error", err)
		os.Exit(1)
	}
	return key
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && go build ./cmd/api/
```

Expected: sem erros, binário gerado

- [ ] **Step 3: Rodar localmente e testar health**

```bash
cd backend
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/inquilinotop?sslmode=disable"
export JWT_PRIVATE_KEY_PATH="./keys/private.pem"
go run ./cmd/api/ &
sleep 2
curl -s http://localhost:8080/health | jq .
kill %1
```

Expected:
```json
{"data": {"status": "ok"}, "error": null}
```

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/api/main.go
git commit -m "feat(backend): adiciona entrypoint da API com wiring completo e health check"
```

---

## Task 15: Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Criar Dockerfile multi-stage**

```dockerfile
# backend/Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api ./cmd/api/

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/api .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
CMD ["./api"]
```

- [ ] **Step 2: Build e verificar imagem**

```bash
cd backend && docker build -t inquilino-api:dev .
docker images inquilino-api:dev
```

Expected: imagem criada, tamanho < 30MB

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat(backend): adiciona Dockerfile multi-stage para produção"
```

---

## Task 16: Rodar suite completa de testes

- [ ] **Step 1: Subir banco de teste**

```bash
cd backend && docker-compose up -d postgres_test
```

- [ ] **Step 2: Rodar todos os testes**

```bash
cd backend
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable" \
go test ./... -v -count=1
```

Expected: PASS em todos os pacotes

- [ ] **Step 3: Commit final da fase**

```bash
git add -A
git commit -m "feat(backend): completa fase 1 — auth, property, tenant operacionais"
```

---

## Checklist de cobertura do spec

| Requisito do spec | Task que implementa |
|---|---|
| Go backend com `chi` | Task 1, 14 |
| Driver `pgx` sem ORM | Task 3, 8, 12, 13 |
| Migrations com `golang-migrate` | Task 3, 7, 11 |
| Auth próprio JWT RS256 | Task 5, 6 |
| Refresh token com revogação | Task 8, 9 |
| Multi-tenancy por `owner_id` | Task 6 (middleware), todos os repos |
| `SINGLE` property cria unit auto | Task 12 (service) |
| Soft delete via `is_active` | Task 12, 13 (repos) |
| CRUD Properties + Units | Task 12 |
| CRUD Tenants | Task 13 |
| Health check | Task 14 |
| Dockerfile multi-stage | Task 15 |
| docker-compose dev | Task 2 |
