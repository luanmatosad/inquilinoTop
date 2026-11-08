## 1. Banco

- [x] 1.1 Migration 000050 (up/down): `payment_links`, colunas `reported_at`, `reported_amount`, `reported_date`, `proof_path` em `payments`, `kind` de `payment_events` com `REPORTED` e `REJECTED`
- [x] 1.2 Teste de repositório: criar/revogar link, hash único, aviso gravado e limpo

## 2. Backend — link e leitura pública

- [x] 2.1 TDD: geração do token (32 bytes, hash), rotação, validade (vencimento + 90, pago + 365, acordo)
- [x] 2.2 `POST /payments/{id}/link` (`APP_PUBLIC_URL`, 422 sem config) e env var documentada
- [x] 2.3 Rotas públicas `GET /public/payments/{token}`, `/pix`, `/receipt` com exposição mínima e 404 uniforme
- [x] 2.4 Middleware de rate limit das rotas públicas (30/min por IP) e `Cache-Control: no-store`
- [x] 2.5 Teste: a resposta pública não contém documento, endereço, e-mail, telefone nem ids internos

## 3. Backend — aviso e confirmação

- [x] 3.1 TDD `POST /public/payments/{token}/report` (valor, data, 409 se paga, limite 5/h por token, substitui aviso)
- [x] 3.2 Upload do comprovante: 5 MB, tipo pelo conteúdo, nome aleatório, via `document.Storage`; erros 413/415
- [x] 3.3 `GET /payments/{id}/proof` autenticado e escopado
- [x] 3.4 `confirm-report` (via MarkPaid, método PIX) e `reject-report` (limpa, apaga arquivo, evento REJECTED)
- [x] 3.5 Situação derivada `AWAITING_CONFIRMATION` na leitura e no filtro `status`; eventos `REPORTED`/`REJECTED` na linha do tempo; `POST /events` recusa os tipos reservados
- [x] 3.6 ~~Notificação ao dono~~ Cortada: o módulo `notification` é uma fila de e-mail e o app não tem sino. O sinal é o chip "Aguardando confirmação" (e, depois, o Hoje)
- [x] 3.7 Ligar tudo em `cmd/api/main.go`, anotações Swagger e `swag init`

## 4. Frontend — página pública

- [x] 4.1 Adicionar `/p` às rotas públicas do middleware; layout `/p/[token]` sem Sidebar, `noindex`, `no-referrer`
- [x] 4.2 Dependência `qrcode` e componente de QR (SVG no servidor)
- [x] 4.3 Inq-1 cobrança com Pix, copiar código e "Já paguei"; estados atrasada, aguardando e link inválido (texto sem pronome: "Avisamos Luan")
- [x] 4.4 Inq-2 formulário (valor, data, comprovante) e server action multipart; Inq-3 confirmação com os 3 passos
- [x] 4.5 Inq-4 cobrança paga com "Baixar recibo" (página de recibo pública para imprimir)
- [x] 4.6 Testes de componente das quatro telas e da validação do formulário

## 5. Frontend — dono

- [x] 5.1 `SendChargeDialog` gera o link (`POST /link`) e usa a URL na mensagem e no copiar
- [x] 5.2 Chip, selo e contagem "Aguardando confirmação" em Recebimentos; ação Confirmar
- [x] 5.3 Diálogo de confirmação com comprovante, "Ainda não recebi" e "Confirmar recebimento"
- [x] 5.4 Linha do tempo da cobrança com `REPORTED` e `REJECTED`

## 6. Fechamento

- [x] 6.1 CLAUDE.md do payment e do backend (última migration 000050, rotas públicas), `frontend/CLAUDE.md`
- [x] 6.2 Suítes backend (`-p 1`) e frontend, lint
- [x] 6.3 Percurso no navegador com dados descartáveis (removidos depois): abrir o link, avisar, ver aviso enviado, cobrança paga, recibo, atrasada. Fica com o dono: gerar o link pelo diálogo, confirmar/recusar pelo chip e conferir 390px real
