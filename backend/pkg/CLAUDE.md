# pkg/ — Pacotes Compartilhados

Nunca duplicar a lógica destes pacotes nos domínios.

## httputil

Todas respostas HTTP. Envelope: `{"data": any, "error": {"code": string, "message": string}}`.

```go
httputil.OK(w, data)                          // 200
httputil.Created(w, data)                     // 201
httputil.Err(w, status, "CÓDIGO", "msg")      // qualquer status de erro
```

## apierr

```go
apierr.ErrNotFound  // sentinel — usar errors.Is() no handler para retornar 404
```

## auth

```go
auth.NewJWTService(privKey, pubKey, expiry)  // RS256, expiry=15min
auth.Middleware(jwtSvc)                       // extrai + valida Bearer token, injeta ownerID no ctx
auth.OwnerIDFromCtx(ctx)                      // retorna uuid.UUID do owner autenticado
```

JWT Claims: `{owner_id: uuid, exp, iat}`.

## db

```go
db.New(ctx, databaseURL)          // retorna *db.DB com pool pgx
db.RunMigrations(url, path)       // aplica migrations golang-migrate
d.Pool                            // *pgxpool.Pool para queries diretas
d.Close()                         // fechar pool
```

Usar `d.Pool.Exec / QueryRow / Query` nas implementações de repositório.

## validator

```go
validator.Validate(struct)  // singleton go-playground/validator/v10, inicializado uma vez
```

Usado para validar structs de input com tags `validate:"required,oneof=..."`. Singleton thread-safe via `sync.Once`.
