---
paths:
  - "backend/**/*_test.go"
---

# Testes do Backend Go

## Dois Níveis de Teste

| Nível | Arquivo | O que testa | Dependências |
|---|---|---|---|
| **Unitário** | `service_test.go`, `handler_test.go` | Lógica de negócio, HTTP handlers | Mock struct local |
| **Integração** | `repository_test.go` | Queries SQL, migrações | DB real via `TEST_DATABASE_URL` |

Nunca usar DB real em testes unitários. Nunca usar mock em testes de repositório.

## Testes Unitários — Mock Struct

O mock DEVE ser uma struct local que implementa a interface `Repository`:

```go
type mockRepo struct {
    items map[uuid.UUID]*Xxx
}

func newMockRepo() *mockRepo {
    return &mockRepo{items: map[uuid.UUID]*Xxx{}}
}

func (m *mockRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*Xxx, error) {
    item, ok := m.items[id]
    if !ok || item.OwnerID != ownerID {
        return nil, errors.New("not found")
    }
    return item, nil
}
// ... implementar todos os métodos da interface
```

O service recebe o mock direto: `svc := NewService(newMockRepo())`.

## Testes de Integração — Helper `testDB`

Todo arquivo `repository_test.go` DEVE ter o helper `testDB`:

```go
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
        d.Pool.Exec(context.Background(), "TRUNCATE users, properties, units, tenants CASCADE")
        d.Close()
    })
    return d
}
```

`TRUNCATE ... CASCADE` no cleanup garante isolamento entre testes.

## Convenções Testify

```go
require.NoError(t, err)         // fatal — para se falhar
require.NotNil(t, result)       // fatal — para se nil

assert.Equal(t, esperado, real) // não-fatal — continua o teste
assert.Len(t, lista, 2)
assert.True(t, condicao)
```

Use `require` para pré-condições que tornariam o restante do teste inválido. Use `assert` para verificações independentes.

## Nomenclatura

```go
func TestXxx_Operação_Cenário(t *testing.T)

// Exemplos:
func TestRepository_CreateProperty_SoftDelete(t *testing.T)
func TestService_CreateProperty_TipoInválido(t *testing.T)
func TestHandler_Create_BodyInválido(t *testing.T)
```

## Executar Testes

```bash
make test-backend              # unitários (sem DB)
make test-backend-integration  # todos + integração (requer Docker)
```

## TDD — Obrigatório

Escrever o teste antes da implementação. O hook `PreToolUse` do projeto verifica se TDD está ativo antes de permitir edições em arquivos de produção.
