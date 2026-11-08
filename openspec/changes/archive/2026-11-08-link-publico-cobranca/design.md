## Context

`cobranca-manual` já entrega Pix estático, eventos imutáveis, `MarkPaid` com recibo numerado e o diálogo de envio. Falta o lado do inquilino. Hoje a única rota sem login é o webhook; o rate limit anônimo é 100 req/s por IP; `document.Storage` (`Save/Load/Delete`) grava arquivos por owner e o `CHECK` de `payments.status` só aceita `PENDING|PAID|LATE`.

## Goals / Non-Goals

**Goals:** link público seguro por cobrança; inquilino vê o Pix, avisa e baixa o recibo; dono confirma ou recusa; nada de dado sensível exposto.
**Non-Goals:** pagamento dentro do app, verificação automática do dinheiro, Pix por imóvel (onda de Configurações), WhatsApp/e-mail automáticos, login do inquilino, pagamento parcial.

## Decisions

1. **"Aguardando confirmação" derivado.** Colunas novas em `payments`: `reported_at`, `reported_amount`, `reported_date`, `proof_path`. Situação = não paga e `reported_at` não nulo. `status` e o enum do domínio não mudam. Alternativa (novo status) descartada: quebra o `CHECK`, o ADR de imutabilidade e todo filtro por status.
2. **Tabela `payment_links`.** `id`, `payment_id`, `organization_id`, `token_hash` (SHA-256, único), `expires_at`, `revoked_at`, `created_at`. Token: 32 bytes de `crypto/rand`, base64url, mostrado uma única vez na criação. Um link ativo por cobrança. O hash não é reversível, então o token só existe na resposta da criação: `POST /payments/{id}/link` sempre **rotaciona** (revoga o ativo e cria outro). Reenviar a mensagem sem rotacionar usa a URL já copiada. Sem segredo recuperável no banco.
3. **Validade.** `expires_at` = vencimento + 90 dias (mínimo hoje + 30). Cobrança paga estende para `paid_date` + 365 dias, para o recibo continuar acessível. Acordo (nova data) recalcula.
4. **Rotas públicas** em `/api/v1/public/payments/{token}`: `GET` (cobrança), `GET /pix`, `POST /report` (multipart), `GET /receipt`. Sem `authMW`; o contexto vem do link (`organization_id`, `payment_id`). Token inválido, expirado ou revogado: 404 `NOT_FOUND` idêntico.
5. **Exposição mínima.** A resposta pública traz: nome do locador (perfil), valor atualizado, vencimento, rótulo da unidade, descrição da competência, situação, Pix (copia-e-cola), `paid_date`/número do recibo se paga. Nunca CPF/CNPJ, endereço, e-mail, outras cobranças, ids internos.
6. **Aviso `POST /report`.** Campos: `amount` (> 0), `paid_date` (não futura, até 60 dias atrás), `proof` opcional. Recusa cobrança paga (409). Reaviso sobrescreve o anterior (e troca o comprovante, apagando o antigo). Grava `REPORTED` com valor e data (na mesma transação). Sem notificação separada: o dono vê o aviso pelo chip em Recebimentos (o módulo `notification` é uma fila de e-mail e o app ainda não tem sino).
7. **Comprovante.** Limite 5 MB; tipo detectado por `http.DetectContentType` nos primeiros 512 bytes (JPEG, PNG, PDF) e não pela extensão; nome aleatório; `http.MaxBytesReader`. Gravado via `document.Storage.Save` com o owner da cobrança; **nunca servido por rota pública**. Dono baixa por `GET /api/v1/payments/{id}/proof` (autenticado, escopo da organização).
8. **Rate limit.** Middleware próprio para `/public/`: 30 req/min por IP; `POST /report` 5 por hora por token. Reaproveita o token bucket de `ratelimit` com outra config; IP via a mesma extração já usada.
9. **Dono confirma.** `POST /payments/{id}/confirm-report` chama `MarkPaid` com método `PIX`, `paid_date` e valor do aviso (dono pode ajustar desconto como na baixa atual); `POST /payments/{id}/reject-report` limpa `reported_*`, apaga o comprovante e grava `REJECTED`. Ambos exigem aviso pendente (409 caso contrário).
10. **Frontend.** `/p/[token]` é server component que chama a API pública sem cookies; `/p` entra nas rotas públicas do middleware; layout próprio sem Sidebar, mobile-first (390px) e centralizado no desktop (`max-w-md`). Server action para o aviso (multipart). QR Code: SVG gerado no servidor com `qrcode`. Metadata `robots: noindex` e `Referrer-Policy: no-referrer` via headers do Next, `Cache-Control: no-store` nas respostas.
11. **Dono, UI.** `SendChargeDialog` chama `POST /payments/{id}/link` e usa a URL (`APP_PUBLIC_URL` + `/p/<token>`) na mensagem e no "copiar link". Recebimentos ganha o chip e o selo "Aguardando confirmação" e a ação Confirmar, que abre o diálogo do canvas (`Pagamento-confirmar`).

## Risks / Trade-offs

- Link vazado = quem tem o link vê o Pix e pode avisar pagamento falso → só o dono baixa; texto "O ImoviFlow não verifica se o dinheiro entrou"; revogação e rotação; expiração.
- Upload anônimo (abuso de disco/arquivo malicioso) → limites, tipo por conteúdo, nome aleatório, sem servir publicamente, rate limit por token. Sem antivírus no MVP.
- Rate limit por IP atrás de proxy depende de `X-Forwarded-For` confiável → mesma limitação do middleware atual; registrar no CLAUDE.md.
- Rotacionar o link invalida o que já foi enviado → aceitável; a mensagem de reenvio leva o novo.
- `APP_PUBLIC_URL` ausente → `POST /link` retorna 422 `PUBLIC_URL_NOT_CONFIGURED`.

## Migration Plan

Migration 000050: tabela `payment_links`, colunas `reported_*`/`proof_path` em `payments`, `kind` do `payment_events` ampliado com `REPORTED` e `REJECTED`. Down remove tudo. Sem backfill. Rollback: reverter a migration; links já enviados deixam de funcionar.

## Open Questions

Nenhuma bloqueante. Pix por imóvel e mensagens automáticas ficam para as ondas de Configurações e Integrações.
