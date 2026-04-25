---
paths:
  - "backend/**/*.go"
---

# Design de API REST — Backend Go

## Roteamento

Rotas DEVEM seguir o padrão versionado com middleware de auth aplicado via `r.With(authMW)`:

```go
func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
    r.With(authMW).Get("/api/v1/recurso", h.list)
    r.With(authMW).Post("/api/v1/recurso", h.create)
    r.With(authMW).Get("/api/v1/recurso/{id}", h.get)
    r.With(authMW).Put("/api/v1/recurso/{id}", h.update)
    r.With(authMW).Delete("/api/v1/recurso/{id}", h.delete)
}
```

Nunca passar `authMW` global no router — aplicar por rota para permitir rotas públicas (ex: `/health`, `/swagger`).

## Respostas HTTP

Sempre via `httputil` — nunca `json.NewEncoder` ou `w.WriteHeader` direto nos handlers:

```go
httputil.OK(w, data)          // 200
httputil.Created(w, data)     // 201
httputil.Err(w, status, "CÓDIGO_MAIÚSCULO", "mensagem legível")
```

Códigos de erro DEVEM ser `SNAKE_CASE_MAIÚSCULO`: `NOT_FOUND`, `INVALID_ID`, `CREATE_FAILED`.

## Validações no Handler

Ordem obrigatória no handler: parse UUID → decode body → chamar service → tratar erro.

```go
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
    ownerID := auth.OwnerIDFromCtx(r.Context())   // 1. extrair ownerID
    id, err := uuid.Parse(chi.URLParam(r, "id"))  // 2. parse UUID
    if err != nil {
        httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
        return
    }
    var in CreateXxxInput                           // 3. decode body
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
        return
    }
    result, err := h.svc.UpdateXxx(r.Context(), id, ownerID, in) // 4. service
    if err != nil {
        // 5. tratar erro
    }
    httputil.OK(w, result)
}
```

## Tratamento de Erros

Verificar `apierr.ErrNotFound` antes de retornar 500:

```go
if errors.Is(err, apierr.ErrNotFound) {
    httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "recurso não encontrado")
    return
}
httputil.Err(w, http.StatusInternalServerError, "OPERATION_FAILED", err.Error())
```

## Swagger — Obrigatório em Toda Rota

Todo handler público DEVE ter annotations completas:

```go
// @Summary     Descrição curta da operação
// @Tags        nome-do-domínio
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id   path   string   true  "ID do recurso"
// @Param       body body   InputType true "Dados"
// @Success     200  {object}  map[string]interface{}
// @Failure     404  {object}  map[string]interface{}
// @Router      /recurso/{id} [put]
```

Após adicionar annotations, rodar `swag init` para atualizar `docs/`.

## Listas Nunca Nil

Handlers de listagem DEVEM garantir slice não-nil antes de responder:

```go
list, err := h.svc.ListXxx(r.Context(), ownerID)
// ...
if list == nil {
    list = []Xxx{}
}
httputil.OK(w, list)
```
