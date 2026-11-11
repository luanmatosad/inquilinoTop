## 1. Backend: migration e eventos (spec payment-events)

- [x] 1.1 Migration `000049` (up/down): tabela `payment_events`, colunas `payments.payment_method`, `discount_amount`, `payment_note`, `original_due_date`, `receipt_number`, `receipt_year`, tabela `receipt_counters` e índice único do recibo; teste de integração da migration
- [x] 1.2 Testes de serviço e handler dos eventos: lista cronológica com marcos Criada e Venceu em, registro de `SENT` e `REMINDER`, `kind` inválido retorna 400, cobrança paga retorna 409, outra organização retorna 404
- [x] 1.3 Testes de repositório (integração) dos eventos
- [x] 1.4 Implementar `payment_events` no `model.go`, `repository.go`, `service.go` e `handler.go` (`GET` e `POST /payments/{id}/events`) com Swagger

## 2. Backend: Pix copia-e-cola (spec pix-payload)

- [x] 2.1 Testes de `pixpayload.Build`: CRC16 de "123456789" = 29B1, payload de referência completo, truncagem e remoção de acentos de nome e cidade, valor com duas casas
- [x] 2.2 Implementar `pixpayload.go` e o endpoint `GET /payments/{id}/pix` (valor atualizado do dia, 422 `PIX_KEY_NOT_CONFIGURED`, 409 para cobrança paga), com testes de handler

## 3. Backend: baixa estendida e recibo numerado (spec accounts-receivable)

- [x] 3.1 Testes de `markPaid` com forma, desconto e observação: líquido com desconto, base do IRRF com desconto, desconto maior que o devido retorna 400, grava o evento `PAID`
- [x] 3.2 Testes do número do recibo: sequencial por organização e ano, estável entre pedidos, atribuição tardia para cobrança antiga, corrida entre dois pagamentos (integração)
- [x] 3.3 Implementar os campos novos em `UpdatePaymentInput`, o cálculo em `markPaid`, o contador atômico de recibos e `Receipt` com `number`, `payment_method` e `discount`; atualizar o Swagger

## 4. Backend: acordo de atraso (spec payment-agreement)

- [x] 4.1 Testes de serviço e handler do acordo: nova data, valor combinado, valor omitido assume o total de hoje, data inválida retorna 400, cobrança paga retorna 409, cobrança com `charge_id` retorna 409, evento `AGREEMENT` com os valores anteriores, volta a `LATE` na nova data
- [x] 4.2 Teste de repositório (integração) do acordo, incluindo `original_due_date` preenchido só na primeira vez
- [x] 4.3 Implementar `POST /payments/{id}/agreement`; atualizar `backend/internal/payment/CLAUDE.md` e regenerar `docs/`; suíte Go (`-p 1`) verde exceto o teste que já falhava

## 5. Frontend: módulos puros

- [x] 5.1 Testes de `valorPorExtenso` (zero, centavos, mil, milhares, "um real", R$ 1.850,00 e R$ 1.585,13)
- [x] 5.2 Testes de `buildChargeMessage` (a vencer, atrasada com total atualizado, sem Pix, editável) e dos links `wa.me` e `mailto:`
- [x] 5.3 Testes de `buildTimeline` (rótulos de Criada, Enviada, Lembrete, Venceu em, Acordo, Pago, "por você") e de `lateBreakdown` (dias, multa, juros, total)
- [x] 5.4 Testes dos schemas de pagamento estendido (forma, desconto) e de acordo (nova data futura, valor)
- [x] 5.5 Implementar `lib/receivable-detail.ts`, `lib/valor-por-extenso.ts` e os schemas em `financial-schemas.ts`

## 6. Frontend: detalhe da cobrança (spec receivable-detail)

- [x] 6.1 Testes da página `financial/receivables/[id]`: cabeçalho, situação, valores, decomposição quando atrasada, linha do tempo, onde recebe com e sem chave, paga sem botões de ação, 404, degradação sem eventos e sem inquilino
- [x] 6.2 Implementar a página, o componente de linha do tempo e as actions de leitura (`getPaymentEvents`)

## 7. Frontend: enviar cobrança

- [x] 7.1 Testes do diálogo: mensagem pronta, lembrete quando atrasada, WhatsApp desabilitado sem celular, editar texto, copiar, marcar como enviada grava o evento e fecha só o parâmetro, aviso sem chave Pix
- [x] 7.2 Implementar `SendChargeDialog` (`?enviar=1`) e as actions `getPixPayload` e `recordPaymentEvent`

## 8. Frontend: registrar pagamento estendido

- [x] 8.1 Testes do diálogo de registrar: forma, desconto, observação, saldo com abatimento, desconto inválido, envio com os campos novos
- [x] 8.2 Atualizar `RegisterPaymentDialog` e a action `payReceivable` para enviar `payment_method`, `discount_amount` e `payment_note`; reutilizar o diálogo no detalhe (`?pagar=1`)

## 9. Frontend: negociar atraso

- [x] 9.1 Testes do painel: total de hoje, nova data inválida, valor padrão e editável, salvar chama a action, não aparece em cobrança em dia
- [x] 9.2 Implementar `AgreementSheet` (`?acordo=1`) e a action `createAgreement`

## 10. Frontend: recibo

- [x] 10.1 Testes da página do recibo: número, extenso, forma, desconto, assinatura, "Baixar PDF", cobrança não paga
- [x] 10.2 Reescrever `financial/receivables/[id]/receipt/page.tsx` no layout do canvas

## 11. Frontend: Recebimentos

- [x] 11.1 Testes da lista: link do nome para o detalhe, ação por situação (Enviar cobrança, Cobrar, Recibo) apontando para `?enviar=1`
- [x] 11.2 Ajustar `ReceivablesList` e atualizar os testes antigos de Recebimentos

## 12. Limpeza e verificação

- [x] 12.1 `make frontend-lint`, suíte Vitest completa e suíte Go (`-p 1`) verdes
- [x] 12.2 Reconstruir e conferir pela API com o usuário de `make seed-dev-user`: Pix gerado (validar o código num app bancário ou decodificador), envio registrado, baixa com forma e desconto, recibo numerado, acordo e volta a atrasar; limpar os dados
- [x] 12.3 Percorrer no navegador, desktop e 390px: detalhe, enviar, registrar, negociar e recibo (imprimir em PDF); registrar o que não foi visto. Visto: desktop e 390px em detalhe, enviar, negociar, registrar e recibo. Bug achado e corrigido em 390px: botão "Confirmar pagamento" estourava o diálogo (`RegisterPaymentDialog.tsx`). Não visto: conteúdo do PDF ("Baixar PDF" abre o diálogo de impressão), "Marcar como enviada" e "Salvar acordo" (não executados)
- [x] 12.4 Atualizar `frontend/CLAUDE.md`, `backend/CLAUDE.md` (migration) e a tabela de páginas
