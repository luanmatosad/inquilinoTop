---
paths:
  - "backend/**/*.go"
---

# Arquitetura do Backend Go

## Estrutura por Domínio

Cada domínio em `internal/<domínio>/` contém exatamente estes arquivos:

| Arquivo | Responsabilidade |
|---|---|
| `model.go` | Tipos do domínio + interface `Repository` |
| `repository.go` | Implementação `pgRepository` da interface |
| `service.go` | Regras de negócio, orquestra o repositório |
| `handler.go` | HTTP: decode → service → httputil response |

Nunca misturar responsabilidades entre arquivos. Handler não acessa repositório diretamente.

## Injeção de Dependência

Construtores DEVEM receber dependências como interfaces:

```go
// ✅ CORRETO
func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

func NewHandler(svc *Service) *Handler {
    return &Handler{svc: svc}
}

// ❌ ERRADO — instanciar dependência internamente
func NewService() *Service {
    return &Service{repo: NewRepository(db.New(...))}
}
```

A composição acontece somente em `cmd/api/main.go`.

## Interface Repository

A interface `Repository` DEVE ser definida em `model.go`, junto com os tipos:

```go
type Repository interface {
    Create(ctx context.Context, ownerID uuid.UUID, in CreateXxxInput) (*Xxx, error)
    GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Xxx, error)
    List(ctx context.Context, ownerID uuid.UUID) ([]Xxx, error)
    Update(ctx context.Context, id, ownerID uuid.UUID, in CreateXxxInput) (*Xxx, error)
    Delete(ctx context.Context, id, ownerID uuid.UUID) error
}
```

## Context

`context.Context` DEVE ser o primeiro parâmetro em toda função de repositório e service:

```go
func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, ...) (*Xxx, error)
func (s *Service) CreateXxx(ctx context.Context, ownerID uuid.UUID, ...) (*Xxx, error)
```

Handler sempre passa `r.Context()` — nunca `context.Background()` em handlers.

## Error Wrapping

Padrão obrigatório: `"domínio.componente: operação: %w"`

```go
// Repositório
return nil, fmt.Errorf("property.repo: create: %w", err)

// Service
return nil, fmt.Errorf("property.svc: imóvel não encontrado: %w", err)
```

## Pacotes Compartilhados (`pkg/`)

| Pacote | Uso |
|---|---|
| `pkg/httputil` | Todas as respostas HTTP — `OK`, `Created`, `Err` |
| `pkg/apierr` | Erros de domínio compartilhados — `ErrNotFound` |
| `pkg/auth` | JWT — `NewJWTService`, `Middleware`, `OwnerIDFromCtx` |
| `pkg/db` | Conexão PostgreSQL — `db.New`, `db.RunMigrations` |

Nunca duplicar lógica destes pacotes nos domínios.

## SOLID — Red Flags

| Sinal | Violação |
|---|---|
| Handler chama `repo.Xxx()` diretamente | SRP + DIP |
| `NewService()` sem parâmetros | DIP |
| `switch` em tipo concreto para dispatch | OCP |
| Interface com 8+ métodos misturados | ISP |
| Método de interface com `panic("not implemented")` | LSP |
