# Proposal

## Why

`ListPending` (`backend/internal/notification/repository.go`) executa um `SELECT` solto, sem transação. Qualquer `FOR UPDATE SKIP LOCKED` nele dura só o statement e não protege nada. Duas instâncias da API rodando `ProcessQueue` pegam as mesmas linhas `pending` e enviam o mesmo e-mail duas vezes. Hoje há 1 instância, mas o worker roda dentro do processo da API, então escalar a API duplica envios. Corrigir agora, antes de escalar.

## What Changes

- `ProcessQueue` passa a processar cada notificação dentro de uma transação curta que reserva a linha com `SELECT ... FOR UPDATE SKIP LOCKED` e reconfirma `status='pending'` após obter o lock.
- Envio e atualização de status (`sent` + `sent_at`, ou `retry_count + 1` em falha) acontecem dentro dessa mesma transação; `COMMIT` ao final da notificação.
- Linhas bloqueadas por outra instância são puladas, não esperadas.
- Nenhuma mudança de schema: sem novo status, sem migration, sem job de recuperação de claims.
- Comportamento de sucesso e falha inalterado: falha continua incrementando `retry_count` e deixando a linha `pending`.

## Capabilities

### New Capabilities

- `notification-queue`: entrega de notificações pendentes pelo worker, com exclusão mútua entre instâncias (cada notificação é enviada por no máximo uma instância por vez).

### Modified Capabilities

Nenhuma.

## Impact

- Código: `backend/internal/notification/repository.go` (`ListPending` e novo método de reserva), `service.go` (`ProcessQueue`), `worker.go` (sem mudança de contrato).
- Testes: teste de integração com duas conexões concorrentes (Docker, `make test-backend-integration`) provando que a mesma notificação não é enviada duas vezes; teste unit do fluxo sucesso/falha com repo fake.
- Banco: uma transação aberta por notificação durante o envio SMTP (uma conexão do pool por vez no worker).
- Não é BREAKING. Não altera API HTTP.
- Risco residual: crash entre o envio e o `COMMIT` reenvia o e-mail (entrega at-least-once). A janela é o tempo de um envio. Aceito; alternativa sem esse risco exige idempotência no provedor de e-mail, fora do escopo.
