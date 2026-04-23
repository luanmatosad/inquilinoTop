# Fase 4: Melhorias Técnicas

**Status:** ⏳ Pendente
**Tasks:** 13 tasks

## Ações Planejadas

### 4.1 Rate Indexation (Reajuste Automático)

**Módulo:** adjustments em `lease`

- [ ] Criar tabela `index_values`
  ```sql
  CREATE TABLE index_values (
    id SERIAL PRIMARY KEY,
    index_type VARCHAR(10),  -- IPCA, IGP-M
    reference_month DATE,
    value DECIMAL(10,4),
    cumulative DECIMAL(10,4),  -- acumulado 12 meses
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Criar endpoint para buscar índices
  - `GET /api/v1/indices/{type}/history`
  - Buscar dados do BCB/API (futuro) ou manual

- [ ] Implementar cálculo
  - Novo valor = valor atual × (1 + índice acumulado)

- [ ] Criar scheduler
  - 30 dias antes do contrato vencer → notificar
  - Owner confirma → aplicar nuovo valor

- [ ] Criar endpoint confirm
  - `POST /api/v1/leases/{id}/adjust` - confirmar ajuste

### 4.2 Graceful Shutdown

**Módulo:** adjustments em `main.go`

- [ ] Adicionar signal handling
  ```go
  func main() {
    // ... existing code ...
    
    // Graceful shutdown
    idleConnsClosed := make(chan struct{})
    
    go func() {
      sigCh := make(chan os.Signal, 1)
      signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
      <-sigCh
      
      slog.Info("shutting down server...")
      srv.Close()
      close(idleConnsClosed)
    }()
    
    if err := srv.ListenAndServe(); err != http.ErrServerClosed {
      slog.Error("server error", "error", err)
      os.Exit(1)
    }
    
    <-idleConnsClosed
  }
  ```

- [ ] Context timeout para shutdown
  - 30 segundos para conexões terminarem

- [ ] Logging de shutdown
  - Logar conexões ativas antes de fechar

### 4.3 API v2

**Módulo:** versionamento

- [ ] Criar grupo de rotas v2
  ```go
  r.Route("/api/v2", func(r chi.Router) {
    // same handlers but v2 versions
  })
  ```

- [ ] Adicionar version header
  ```go
  w.Header().Set("API-Version", "2.0")
  ```

- [ ] Deprecar v1 com warnings
  - Adicionar header `Deprecation: /api/v1`

- [ ] Documentar breaking changes
  - Criar CHANGELOG.md

## Arquivos a Modificar

```
backend/
├── migrations/
│   └── 000024_create_index_values.up.sql
└── cmd/api/main.go  # + graceful shutdown

internal/lease/
  - handler.go    # + adjust endpoint
  - service.go   # + rate calculation
```

## Fluxo Rate Indexation

```
1. Scheduler verifica contratos com 30 dias para vencer
2. Sistema busca índice (IPCA/IGP-M) do mês
3. Calcula nuevo valor do aluguel
4. Envia email para owner com nuevo valor
5. Owner acessa dashboard → vÊ notificação
6. Owner confirma ou recusa
7. Se confirmado →novo lease com valor ajustado
```