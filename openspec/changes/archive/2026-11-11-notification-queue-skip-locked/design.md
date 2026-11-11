# Design

## Context

`pgRepository.ListPending` (`backend/internal/notification/repository.go`) faz `SELECT` com `WHERE owner_id IS NOT NULL AND status='pending' AND (scheduled_at IS NULL OR scheduled_at <= NOW()) ORDER BY created_at LIMIT n`, sem transação. `Service.ProcessQueue` itera sobre o resultado, chama `emailSender.Send` e depois `UpdateStatus`/`IncrementRetry` via `s.repo`, cada um com o pool. O worker (`worker.go`) dispara `ProcessQueue` a cada `interval`. Ver proposal.md - Why.

Não existe tabela de lock, nem coluna de claim, nem status `processing`. O schema de `notifications` não tem CHECK de status que precise mudar para a solução escolhida.

## Goals / Non-Goals

**Goals:**
- Duas instâncias do worker nunca enviam a mesma notificação ao mesmo tempo.
- Preservar a semântica atual: sucesso marca `sent` + `sent_at`; falha incrementa `retry_count` e mantém `pending`.
- Sem migration.

**Non-Goals:**
- Limite máximo de retries (hoje não existe; continua não existindo).
- Idempotência no provedor de e-mail.
- Mudança de intervalo, batch size ou API HTTP.
- Recuperação de claims travados (não há claim persistente: o lock some com a transação).

## Decisions

**D1. Lock por linha dentro de transação curta (escolhida).**

Fluxo por notificação, em `ProcessQueue`:
1. `ListPending` continua listando ids candidatos (sem lock; pode ficar desatualizado).
2. Para cada id: `BEGIN`; `SELECT ... WHERE id=$1 AND status='pending' AND (scheduled_at IS NULL OR scheduled_at <= NOW()) FOR UPDATE SKIP LOCKED`. Se não retornar linha (outra instância tem o lock, ou já foi enviada), `ROLLBACK` e segue.
3. Envia. Sucesso: `UPDATE status='sent', sent_at=now`. Falha: `UPDATE retry_count = retry_count + 1`.
4. `COMMIT`.

O `status='pending'` dentro do `SELECT ... FOR UPDATE` é a reconfirmação necessária: sem ela, uma linha que outra instância acabou de enviar e commitou poderia ser reenviada por uma instância com lista antiga.

Implementação: o repositório expõe um método que recebe o id e um callback `func(n Notification) error`; ele abre a tx, faz o `SELECT FOR UPDATE SKIP LOCKED`, chama o callback (que é o envio), aplica o `UPDATE` de status conforme o retorno e faz `COMMIT`. O serviço continua dono da regra de sucesso/falha; o repositório dono da transação. Nome e assinatura exatos ficam para a implementação, desde que `ProcessQueue` não abra transação.

**D2. Alternativa descartada: claim com status `processing`.**

`UPDATE ... SET status='processing' WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`, envia fora da transação, depois `sent` ou volta para `pending`. Rejeitada: exige novo status (mudança de dados e de contrato de status), e um crash entre o claim e o envio deixa a linha em `processing` para sempre, o que pede job de recuperação com timeout. Mais partes móveis para o mesmo resultado.

**D3. Alternativa descartada: uma transação para o lote inteiro.**

Rejeitada: segura row locks de até 50 notificações durante todos os envios SMTP (vários segundos) e uma falha no meio reverte o status de linhas já enviadas, aumentando reenvios.

## Risks / Trade-offs

- **Conexão aberta durante SMTP**: uma transação por vez no worker, então uma conexão do pool fica ocupada por um envio. Custo aceito com 1 worker sequencial. Se o pool estiver saturado pela API, o worker espera (timeout do ctx).
- **At-least-once**: crash após o envio e antes do `COMMIT` reenvia o e-mail. A janela é um envio. Sem idempotência no provedor, isso não é eliminável só no banco. Aceito e documentado.
- **Falha de `UPDATE` após envio bem-sucedido**: se o `COMMIT` falhar, o e-mail foi enviado mas a linha segue `pending`, reenvio na próxima rodada. Mesma classe do item anterior. Hoje o código ignora o erro de `UpdateStatus` (`service.go` L47); a versão nova deve propagar o erro de commit para log, sem mudar o fluxo.
- **Ordem**: `ORDER BY created_at` é aplicado na lista de candidatos; o lock por linha não preserva ordem estrita entre instâncias. Aceito: a fila não tem garantia de ordem hoje.
- **Teste de concorrência**: exige Postgres real; cobertura só em `make test-backend-integration`. Unit cobre só a lógica de sucesso/falha com repo fake.
