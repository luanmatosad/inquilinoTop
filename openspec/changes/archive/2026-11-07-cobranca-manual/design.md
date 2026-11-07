## Context

Telas do canvas: `Cobranca-detalhe`, `Cobranca-enviar`, `Pagamento-registrar`, `Cobranca-atrasada`, `Negociar-atraso`, `Recibo`. As do inquilino (`Inq-1` a `Inq-4`) e `Pagamento-confirmar` ficam para a onda B. Estado atual, verificado no repo:

- **`payment`:** `Payment` com `due_date`, `gross_amount`, multa, juros, IRRF, `net_amount`, `status` (`PENDING`, `PAID`, `LATE`), campos de cobrança por provedor. `PUT /payments/{id}` com `status=PAID` e `paid_date` chama `markPaid`, que calcula multa e juros por dias de atraso, IRRF para inquilino PJ e valor líquido. `BuildReceipt` monta o recibo; não há número. Não existe tabela de eventos.
- **Pix:** `financial_config.pix_key` existe e é editável em `/settings/financial` (provedor `MOCK` = "Manual / Direto"). Não há geração de Pix copia-e-cola.
- **Frontend:** `/financial/receivables` (onda anterior) lista as cobranças e abre um diálogo de pagamento só com a data; `/financial/receivables/[id]/receipt` é um recibo simples com `PrintButton`; `whatsappUrl` já monta `wa.me`.
- **Notificações:** o módulo `notification` envia e-mail por fila, sem WhatsApp. Não será usado nesta onda.

## Goals / Non-Goals

**Goals:** o dono conduz uma cobrança do envio ao recibo sem sair do sistema, com histórico; recibo numerado e imprimível; Pix copia-e-cola válido na mensagem.

**Non-Goals:** link público, "já paguei", Aguardando confirmação, pagamento parcial, Parcelar, régua automática, envio de e-mail pelo servidor, comprovante, recibo por link.

## Decisions

**1. Eventos em `payment_events` (migration `000049`).**
Colunas `id`, `organization_id`, `payment_id`, `kind` (`SENT`, `REMINDER`, `AGREEMENT`, `PAID`), `channel` (`WHATSAPP`, `EMAIL`, `COPY`, nulo), `data JSONB`, `actor_id`, `occurred_at`; índice por `(payment_id, occurred_at)`, escopado por organização. A linha do tempo devolvida pela API soma os eventos gravados com dois marcos calculados: **Criada** (de `created_at`, "gerada pelo contrato") e **Venceu em** (quando vencida e não paga). Eventos nunca são editados nem apagados. `GET /payments/{id}/events` lista; `POST /payments/{id}/events` aceita só `SENT` e `REMINDER` com `channel`; `AGREEMENT` e `PAID` nascem dentro das operações que os causam. O front mostra "por você" quando o `actor_id` é o do usuário da sessão e "por um membro da equipe" nos demais.

**2. Pix estático, sem provedor.**
`pixpayload.Build(key, merchantName, city, amount, txid)` gera o BR Code (EMV com campos 00, 26 com GUI `br.gov.bcb.pix`, 52, 53, 54, 58, 59, 60, 62 e CRC16-CCITT), com nome truncado em 25 e cidade em 15 caracteres, em maiúsculas sem acento. `GET /payments/{id}/pix` devolve `{payload}` com o valor atualizado do dia (bruto + multa + juros se atrasada); o `txid` é derivado do id da cobrança. Sem chave cadastrada, responde 422 `PIX_KEY_NOT_CONFIGURED` e a tela leva a `/settings/financial`. Nome do recebedor: o do dono; cidade: a do imóvel da unidade, com "BRASIL" como último recurso. Alternativa descartada: cobrança pelo provedor (`CreateCharge`), porque o canvas diz que o ImoviFlow não recebe nem guarda o dinheiro.

**3. Registrar pagamento estende o `PUT`.**
`UpdatePaymentInput` ganha `payment_method` (`PIX`, `CASH`, `TRANSFER`, `BOLETO`, `OTHER`), `discount_amount` (≥ 0, ≤ valor devido) e `payment_note` (até 500), usados só ao marcar `PAID`; omitidos mantêm o comportamento de hoje. `markPaid` passa a calcular `net = bruto + multa + juros − desconto − IRRF`, com a base do IRRF igual a `bruto + multa + juros − desconto` (o valor de fato pago). Colunas novas em `payments`: `payment_method`, `discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0`, `payment_note`. Grava o evento `PAID`. Valor parcial fica fora: o campo "Valor recebido" da tela é só leitura.

**4. Número do recibo.**
Tabela `receipt_counters (organization_id, year, last_number)` e colunas `payments.receipt_number` e `receipt_year`, com índice único `(organization_id, receipt_year, receipt_number)`. O número é tirado no `markPaid` com `INSERT … ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING`, na mesma transação do pagamento. Cobranças pagas antes desta mudança recebem o número na primeira emissão do recibo. O ano é o do `paid_date`. Formato `0001/2026`.

**5. Acordo = nova data e valor combinado.**
`POST /payments/{id}/agreement` com `new_due_date` (posterior a hoje), `agreed_amount` (> 0, opcional, padrão o total de hoje) e `note`. Só vale para cobrança aberta (`PENDING` ou `LATE`) sem `charge_id`. Efeito: `due_date` vira a nova data e `gross_amount` vira o valor combinado; `original_due_date` e o valor anterior ficam no evento `AGREEMENT` (e `original_due_date` em coluna, preenchida na primeira vez). A cobrança sai de `LATE`; se a nova data passar sem pagamento, volta a `LATE` e multa e juros contam a partir da nova data. É atualização de linha, não remoção (ADR payment-0001). Parcelar e abater multa por regra ficam fora.

**6. Enviar cobrança sem servidor.**
A mensagem é montada no frontend (`buildChargeMessage`) com nome, mês, unidade, valor, vencimento e o Pix copia-e-cola; é editável. "Abrir WhatsApp" usa `whatsappUrl` com `?text=`, e "E-mail" usa `mailto:`. O sistema não sabe se o dono enviou; por isso o botão **Marcar como enviada** grava o evento. Sem celular válido, o WhatsApp fica desabilitado com a dica; sem e-mail, o e-mail fica desabilitado. Cobrança atrasada usa o texto de lembrete e grava `REMINDER`.

**7. Recibo.**
Reescrito no layout do canvas: título, número, valor, texto com valor por extenso (`valorPorExtenso`, módulo puro), forma de pagamento, desconto quando houver, assinatura do dono e rodapé. "Baixar PDF" é o `window.print()` existente com CSS de impressão; PDF gerado no servidor fica para depois. `GET /payments/{id}/receipt` passa a devolver `number`, `payment_method` e `discount`. Os botões "Enviar por WhatsApp" e "Copiar link" do canvas ficam para a onda B.

**8. Rotas e atualização das telas.**
O detalhe vive em `/financial/receivables/[id]`; o recibo continua em `/financial/receivables/[id]/receipt`. Painéis por URL: `?enviar=1` (diálogo de envio), `?acordo=1` (painel de negociação), `?pagar=1` (registrar). A linha de Recebimentos liga o nome ao detalhe e mostra a ação do canvas: Previsto → Enviar cobrança, Atrasado → Cobrar, Pago → Recibo. O diálogo "Registrar pagamento" do topo e da linha ganha forma, desconto e observação.

## Risks / Trade-offs

- [BR Code com campo errado faz o banco recusar o código] → teste com vetores conhecidos (CRC16 `123456789` = `29B1` e um payload completo de referência) e validação manual com um app bancário na verificação.
- [Chave Pix cadastrada como CPF/telefone aparece na mensagem] → o código copia-e-cola não revela a chave em texto, mas o banco mostra o nome do recebedor; avisar na tela de envio quando a chave não estiver cadastrada.
- [Número de recibo duplicado em corrida] → contador atômico na transação e índice único.
- [Acordo muda `gross_amount`, e o recibo mostra o valor combinado em vez do contratual] → o evento guarda o valor original e o recibo mostra o desconto/abatimento só quando registrado como desconto; documentar.
- [Dono não envia de fato depois de abrir o WhatsApp] → "Marcar como enviada" é uma ação explícita, nunca automática.
- [IRRF sobre valor com desconto] → regra explícita no design e nos testes; revisar com contabilidade se necessário.

## Migration Plan

Migration `000049` só adiciona tabelas e colunas com padrão; `down` remove. Sem backfill de eventos antigos; os recibos de cobranças já pagas ganham número sob demanda.

## Open Questions

- Texto padrão das mensagens e da assinatura ("— Luan") será o do canvas, com o primeiro nome do dono.
