## Context

Telas do canvas: `Main` (desktop), `Mobile`, `Hoje-vazio` e `M-Hoje-vazio`. Estado atual, verificado no repo: `/` mostra o painel antigo via `GET /dashboard/metrics`; Recebimentos já busca `GET /payments?from&to` mais `?status=LATE` e `awaiting_confirmation` já vem derivado; `ConfirmReportDialog` e `ReceivableItem` existem em `components/financial`; o detalhe da cobrança abre o envio por `?enviar=1` e o contrato abre o reajuste por `?reajustar=1`; `lease-overview.ts` tem `todaySaoPaulo`, `isReadjustmentPending`, `isReadjustSoon`. O `index_values` não é alimentado (scheduler é stub).

## Goals / Non-Goals

**Goals:** Hoje fiel ao canvas (desktop e celular) com as ações que já existem; conta nova com checklist.
**Non-Goals:** sino de notificações, percentual do reajuste, onboarding completo, Exportar, endpoint novo no backend.

## Decisions

1. **Dados no servidor Next, sem endpoint novo.** Cinco buscas com `Promise.allSettled`: pagamentos do mês, pagamentos `LATE`, contratos, inquilinos e imóveis; mais a configuração financeira (chave Pix) e o perfil (nome). Pagamentos são obrigatórios; o resto degrada (nome vira "—", unidade some). Junção em função pura `lib/today-overview.ts`.
2. **Listas e janelas.**
   - *Confirmar pagamento:* cobranças `RENT` não pagas com `awaiting_confirmation`, mais antigo aviso primeiro.
   - *Atrasados:* `LATE` sem aviso pendente, a mais atrasada primeiro; "N dias de atraso" e "Venceu em dd/mm".
   - *Para cobrar:* `PENDING` sem aviso, vencimento de hoje até 7 dias; "Vence em N dias" (hoje: "Vence hoje"). Sem checar envio anterior (exigiria um evento por cobrança).
   - *Fique de olho:* contratos `ACTIVE` com reajuste pendente ou nos próximos 30 dias; contratos `ACTIVE` com `end_date` nos próximos 60 dias ("termina em N dias").
   - Uma cobrança aparece em uma lista só (aviso pendente tem prioridade sobre atrasada e a cobrar).
3. **Contagem do cabeçalho:** confirmar + atrasados + para cobrar + itens do fique de olho. Zero: "Nada para resolver hoje." Singular/plural corretos.
4. **Indicadores:** mesmos de Recebimentos (Previsto, Recebido com barra de progresso, Em atraso com "a mais antiga há N dias") sobre as mesmas linhas do mês mais atrasadas, para os números baterem entre as telas.
5. **Ações sem duplicar diálogos.** Confirmar abre `ConfirmReportDialog` (client, estado local). Cobrar e Enviar cobrança são links para `/financial/receivables/{id}?enviar=1`. Revisar reajuste é link para `/leases/{id}?reajustar=1`; Ver contrato, para `/leases/{id}`. WhatsApp direto na lista fica fora: o envio precisa da mensagem e do link do diálogo.
6. **Reajuste sem percentual.** Texto "Reajuste do {unidade} chega em {data} (IGP-M)" com o índice do contrato; sem valor novo, porque o acumulado não existe no sistema.
7. **Conta nova = nenhum contrato** (qualquer status). Mostra Primeiros passos no lugar das quatro listas; os indicadores ficam zerados como no canvas. Passos: conta (sempre feito), imóvel (`properties > 0`), inquilino (`tenants > 0`), contrato (`leases > 0`, desabilitado sem imóvel e inquilino), Pix (`pix_key` preenchida). Cada passo tem um botão para a tela certa. Cartão "Importar planilha" leva a `/import`. Com contrato, o checklist some.
8. **Saudação** por hora em São Paulo (bom dia até 11:59, boa tarde até 17:59, boa noite) com o primeiro nome do perfil; sem nome, só "Bom dia". Data por extenso em pt-BR.
9. **Layout.** Desktop: cabeçalho, três KPIs, quatro cartões em coluna única de largura limitada; celular: KPIs 2 colunas (Recebido e Em atraso), cartões com botões de 44px. Sem sino no cabeçalho (seção 05).
10. **Remoções.** `components/dashboard/*`, `data/dashboard/*` e `dashboardMapper.test.ts` saem; o backend `/dashboard/metrics` fica.

## Risks / Trade-offs

- Hoje faz 7 chamadas por carga → todas em paralelo e já usadas em Recebimentos; se a base crescer, mover a junção para o backend (mesmo shortcut de `financial-overview.ts`).
- "Para cobrar" pode listar quem já recebeu a mensagem → a cobrança tem a linha do tempo no detalhe; filtro por envio fica para quando houver agregação no backend.
- Contrato sem `next_readjustment` não entra no "fique de olho".

## Migration Plan

Só frontend. Rollback: reverter o commit; o painel antigo volta.

## Open Questions

Nenhuma bloqueante.
