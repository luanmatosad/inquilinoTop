## Why

Recebimentos lista as cobranças, mas o dono ainda não consegue conduzir uma cobrança do início ao fim dentro do sistema: não há detalhe, não há como enviar a cobrança com o Pix, o pagamento registrado não guarda forma nem desconto, o recibo não tem número, e um acordo de atraso vive fora do sistema. O canvas (seção 04) desenha esse ciclo. Esta onda entrega a parte que depende só do dono; o link público para o inquilino e o "já paguei" ficam para a onda seguinte, para não abrir uma superfície sem login antes da hora.

## What Changes

- Detalhe da cobrança (`/financial/receivables/[id]`): cabeçalho, situação, linha do tempo, valor (com o valor atualizado detalhado quando atrasada), inquilino, contrato e onde recebe.
- **Enviar cobrança** e **Cobrar de novo**: mensagem pronta com o Pix copia-e-cola dentro do texto, por WhatsApp (`wa.me`) ou e-mail (`mailto:`), editável e copiável, com "Marcar como enviada" que grava o evento.
- Linha do tempo da cobrança, guardada em `payment_events` (enviada, lembrete, acordo, pagamento) mais os marcos calculados (criada, venceu).
- Pix copia-e-cola estático (BR Code) gerado no backend a partir da chave Pix já cadastrada em `financial_config`, sem provedor de pagamento e sem o ImoviFlow tocar no dinheiro.
- **Registrar pagamento** completo: forma de pagamento, desconto e observação, gravados na cobrança e mostrados no recibo.
- **Negociar atraso**, só com nova data de vencimento e valor combinado, gravando o acordo na linha do tempo; o vencimento original fica preservado.
- **Recibo** numerado por organização e ano (Nº 0001/2026), com valor por extenso, forma de pagamento, desconto e "Baixar PDF" pela impressão do navegador.
- Recebimentos: a linha ganha o link para o detalhe e a ação do canvas (Enviar cobrança, Cobrar ou Recibo).
- Fora desta etapa: link público e páginas do inquilino, Aguardando confirmação e Confirmar, pagamento parcial e saldo, Parcelar, abater multa por regra, pausar lembretes e régua automática, e-mail enviado pelo sistema, comprovante, recibo por WhatsApp/link, Exportar.

## Capabilities

### New Capabilities
- `payment-events`: linha do tempo da cobrança (eventos gravados e marcos calculados) e registro de envio.
- `pix-payload`: geração do Pix copia-e-cola estático a partir da chave do dono.
- `payment-agreement`: acordo de atraso com nova data e valor combinado.
- `receivable-detail`: tela de detalhe da cobrança, envio da cobrança e negociação.

### Modified Capabilities
- `accounts-receivable`: baixa manual com forma, desconto e observação; recibo numerado.
- `receivables-overview`: registrar pagamento com os novos campos e ações da linha.

## Impact

- Backend `payment`: migration `000049` (tabela `payment_events`, colunas de pagamento e contador de recibos), `model.go`, `repository.go`, `service.go`, `handler.go`, novo `pixpayload.go`, testes, Swagger.
- Frontend: nova página `financial/receivables/[id]`, componentes de timeline, envio e acordo, recibo reescrito, `ReceivablesList` ajustada, módulos puros em `lib/` e testes.
- Dependência existente: `financial_config.pix_key` (editável hoje em `/settings/financial`).
