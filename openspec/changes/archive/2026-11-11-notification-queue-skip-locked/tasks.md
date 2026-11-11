# Tasks

## 1. Reserva por linha no repositório

- [x] 1.1 Método `ReserveAndSend` em `repository.go`: transação, `SELECT ... FOR UPDATE SKIP LOCKED` com os mesmos filtros, envio, `sent`+`sent_at` ou `retry_count+1`, antes do `COMMIT`
- [x] 1.2 Sem linha (ou já reservada por outro worker): `(false, nil)` e rollback via `defer`
- [x] 1.3 Interface `Repository` atualizada; `UpdateStatus` e `IncrementRetry` removidos; fakes de `service_test.go` e `worker_test.go` ajustados

## 2. ProcessQueue

- [x] 2.1 `Service.ProcessQueue` em `service.go` usa `ReserveAndSend` por id candidato; não abre transação própria
- [x] 2.2 Erro de reserva/UPDATE/COMMIT propagado do repo e logado com `slog.Error` no `ProcessQueue` (antes ignorados em `service.go` L43 e L47)
- [x] 2.3 `ListPending` mantém a mesma consulta e retorna apenas ids; reserva em `ReserveAndSend`

## 3. Testes

- [x] 3.1 Teste unit de `ProcessQueue` com repo fake: envio por id reservado; erro de reserva não interrompe a fila. Estado sent/retry e linha não reservada ficam em 3.2 (repo real, `repository_test.go`), já que o fake não tem SQL
- [x] 3.2 Teste de integração: `repository_test.go` cobre sucesso (sent+sent_at), falha (retry acumula, pending), agendada no futuro, linha bloqueada pulada sem espera, e duas goroutines disputando a mesma notificação com um único envio
- [x] 3.3 `make test-backend-integration` (`-p 1 ./...`) exit 0, sem `FAIL`/`panic` (`/tmp/tbi_notif.log`). `make test-backend` exit 0 antes (`/tmp/tb_notif2.log`)

## 4. Documentação

- [x] 4.1 `backend/CHANGELOG.md` `[Unreleased]`: entrada "Fila de notificações com exclusão mútua (`FOR UPDATE SKIP LOCKED` por linha)"
- [x] 4.2 `backend/internal/notification/CLAUDE.md`: descrever a reserva por linha e o risco at-least-once; hoje cita `ListPending` sem menção a lock
- [x] 4.3 `graphify update .` exit 0 (10518 nodes, 26951 edges; `/tmp/graphify_notif.log`)

## 5. Fechamento

- [x] 5.1 Confirmado pelo usuário para arquivar
