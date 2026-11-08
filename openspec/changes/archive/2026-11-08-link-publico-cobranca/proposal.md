## Why

O ciclo de cobrança manual (`cobranca-manual`) termina no dono: ele envia o Pix, espera e baixa na mão. O canvas (Inq-1 a Inq-4 e `Pagamento-confirmar`) fecha o ciclo do lado do inquilino: uma página sem login com o Pix, o aviso "já paguei" e o recibo, e o dono só confirma. Sem isso o dono segue perguntando no WhatsApp se pagaram.

## What Changes

- Link público por cobrança (`/p/<token>`), criado ao enviar a cobrança e reaproveitado nos reenvios; o banco guarda só o hash do token, com validade e revogação.
- Página pública do inquilino: cobrança com Pix copia-e-cola e QR Code (Inq-1), "Já paguei" com valor, data e comprovante opcional (Inq-2), confirmação do aviso (Inq-3) e cobrança paga com recibo (Inq-4).
- Aviso de pagamento do inquilino gravado na cobrança (`reported_*`, comprovante) e evento `REPORTED`; a situação "Aguardando confirmação" é **derivada** (como `LATE`), sem mudar o `CHECK` de `status`.
- Dono: chip e selo "Aguardando confirmação" em Recebimentos, diálogo "Confirmar pagamento" com o comprovante, "Confirmar recebimento" (usa o `MarkPaid` existente) e "Ainda não recebi" (evento `REJECTED`, limpa o aviso).
- Recibo público por token, só depois de paga.
- Rate limit próprio e mais baixo nas rotas públicas; cabeçalhos `noindex`, `no-referrer`, `no-store`.
- Dependência nova: `qrcode` (frontend, SVG gerado no servidor).

## Capabilities

### New Capabilities
- `public-payment-link`: token, validade e revogação do link, rotas públicas de leitura (cobrança, Pix, recibo), exposição mínima de dados e proteções da rota anônima.
- `payment-report`: aviso "já paguei" do inquilino, upload do comprovante, confirmação e recusa pelo dono, situação derivada "Aguardando confirmação".

### Modified Capabilities
- `payment-events`: novos `kind` `REPORTED` e `REJECTED` (gravados pelo sistema, nunca por `POST /events`).
- `receivables-overview`: chip e selo "Aguardando confirmação" com contagem e ação Confirmar.

## Impact

- Backend `internal/payment` (links, aviso, confirmação, comprovante), migration 000050, `cmd/api/main.go` (rotas públicas, rate limit), integração com `notification` e `document.Storage`, Swagger.
- Frontend: rota `/p/[token]` fora do middleware de login e sem Sidebar, componentes de recebimentos (chip, selo, diálogo), `SendChargeDialog` passa a gerar o link, dependência `qrcode`.
- Segurança: primeira rota anônima que mostra dados e aceita arquivo; revisão dedicada no design.
