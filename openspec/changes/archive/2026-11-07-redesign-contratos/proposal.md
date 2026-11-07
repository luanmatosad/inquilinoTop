## Why

Contratos é a terceira tela da Onda 1 e a que liga Imóveis a Inquilinos. O canvas "ImoviFlow — Telas" pede lista com indicadores, criação em painel, detalhe completo (cobranças, reajustes, termos, anexo), encerramento com data e motivo e reajuste com prévia. O frontend atual tem dialogs soltos, e o backend não tem quatro coisas que o canvas assume: índice e mês de reajuste no contrato, data e motivo ao encerrar, aluguel de referência da unidade e atualização das cobranças futuras quando o aluguel é reajustado. Esta change fecha o núcleo; o aditivo em PDF fica em outra.

## What Changes

**Backend**
- `leases` ganha `adjustment_index` (IGP-M ou IPCA, opcional), `adjustment_month` (1 a 12) e `end_reason`. Contratos existentes recebem `adjustment_month` = mês de `start_date`.
- A API devolve `next_readjustment` (campo calculado): primeiro mês de reajuste 12 meses depois do último reajuste aplicado, ou do início do contrato.
- `POST /leases/{id}/end` aceita `end_date` e `reason` (ambos opcionais, padrão "hoje" e sem motivo). As cobranças futuras são canceladas a partir da data de saída, não de hoje.
- `POST /leases/{id}/readjust` passa a **atualizar o valor das cobranças `RENT` futuras `PENDING` sem cobrança emitida** (vencimento a partir da data do reajuste). As que já têm cobrança emitida ficam para decisão manual, como no encerramento. A resposta informa quantas foram atualizadas.
- `units` ganha `reference_rent` (opcional), o "aluguel de referência" adiado em Imóveis, que pré-preenche o aluguel ao criar o contrato.
- ADR `payment-0004`, Swagger e `domain-model.md` atualizados.

**Frontend (`/leases`)**
- Lista com 4 indicadores (Ativos e soma do aluguel, Vencendo em 30 dias, Reajuste em 90 dias, Encerrados), tabela (Unidade, Inquilino, Início, Fim, Aluguel, Próx. reajuste, Situação), busca, filtro por situação, estados vazio e de erro, e cards no celular.
- Criação em painel lateral (`?novo=1`, com `&inquilino=` e `&unidade=` para pré-selecionar), com aluguel sugerido pela unidade, índice e mês de reajuste, multa e juros e geração de 12 cobranças.
- Detalhe: cobranças recentes, histórico de reajustes, termos, partes e anexo do contrato assinado.
- Encerrar (data de saída e motivo) e Reajustar (prévia do novo aluguel e aviso por WhatsApp) em painéis por URL (`?encerrar=1`, `?reajustar=1`). Editar em painel (`?editar=1`).
- Multa e juros aparecem **em % ao mês** na tela e são convertidos para o valor diário que o backend guarda.
- O botão "Criar contrato" do detalhe do inquilino passa a abrir o painel já com o inquilino escolhido.
- **BREAKING** (tela): as abas do detalhe (dados, cobranças, reajustes) e os `Dialog` de renovar, reajustar e encerrar saem; o conteúdo migra para o detalhe em cartões e painéis.

**Fora de escopo (adiado):** aditivo em PDF (change `contrato-aditivo`), botão "Renovar" separado (prorrogar passa a ser aditivo), "Recebe em" (Pix), "Aguardando confirmação", regras de multa e juros por organização, fiador.

## Capabilities

### New Capabilities
- `lease-overview`: linhas, indicadores e situação da lista de contratos derivados de contratos, inquilinos e imóveis, e conversão de juros mensal para diário.

### Modified Capabilities
- `lease-management`: índice e mês de reajuste, próximo reajuste, encerramento com data e motivo, reajuste que atualiza cobranças futuras, telas de contrato e anexo do contrato assinado.
- `property-registry`: dados da unidade passam a incluir o aluguel de referência.

## Impact

- Backend: `backend/internal/lease/**` (model, service, repository, handler, testes), `backend/internal/payment/**` (novo método para atualizar futuras), `backend/internal/property/**` (campo da unidade), duas migrations (`000047`, `000048`), `backend/docs/`, ADR e `domain-model.md`.
- Frontend: `src/app/leases/**`, `src/components/leases/**`, `src/components/properties/UnitForm.tsx` e `schemas.ts` (aluguel de referência), `src/app/tenants/[id]/page.tsx` (destino do "Criar contrato"), novos módulos em `src/lib/`, testes.
- Dados: colunas novas e opcionais; backfill só de `adjustment_month`. Nenhuma remoção.
- Dinheiro: o reajuste passa a alterar `gross_amount` de cobranças pendentes. É uma atualização (permitida pelo ADR `payment-0001`), nunca remoção, e só atinge as sem cobrança emitida.
- Dependências: nenhuma nova.
