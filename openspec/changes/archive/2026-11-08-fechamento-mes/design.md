## Context

Canvas: `Fechamento-mes` (Previsto, Recebido, Em atraso; "Antes de fechar": informados confirmados, recibos gerados, cobranças em atraso com nomes), `Fechamento-confirmar` (diálogo) e `Fechamento-fechado` (somente leitura, "Fechado em dd/mm/aaaa, hh:mm por {nome} com N pendência(s)", Reabrir mês, histórico). Hoje: Recebimentos usa o valor bruto e soma `RENT` do mês mais atrasadas de outros meses; recibos numerados existem em `payments.receipt_number`; escopo por `organization_id`.

## Goals / Non-Goals

**Goals:** retrato imutável do mês fechado; reabrir com motivo e histórico; telas do canvas.
**Non-Goals:** travar cobranças do mês, resumo em Relatórios, despesas, fechamento automático, permissões novas.

## Decisions

1. **Retrato, não trava.** Fechar grava os números num `jsonb`; as cobranças continuam editáveis (um pagamento tardio muda Recebimentos, não o retrato). Evita acoplar `payment` ao fechamento.
2. **Cálculo no backend.** `closing.Service` lê as cobranças `RENT` com vencimento no mês (leitor de pagamentos por interface, como `LeaseReader` em `payment`) e monta o retrato; o cliente nunca envia números.
3. **Critério dos números** igual ao de Recebimentos, para as telas baterem: previsto, recebido (`PAID`) e em atraso (não pagas) somam o valor **bruto**; "em atraso" inclui avisos ainda não confirmados. Só `RENT` com vencimento no mês (as atrasadas de outros meses pertencem ao mês delas).
4. **Pendências não bloqueiam.** Retrato guarda a lista (`payment_id`, inquilino, valor, `awaiting` sim/não). A tela lista antes de fechar e mostra "com N pendência(s)" depois.
5. **Só meses passados.** `month` < mês corrente em `America/Sao_Paulo`, senão 422 `MONTH_NOT_ENDED`. Formato `AAAA-MM`, senão 400.
6. **Um fechamento ativo por mês.** `month_closings(organization_id, month, is_active)` com índice único parcial em `is_active`. Fechar de novo com o mês fechado = 409 `ALREADY_CLOSED`. Reabrir = `is_active=false` (sem DELETE, regra do projeto), motivo obrigatório (≥ 3 caracteres), 409 `NOT_CLOSED` se aberto. Fechar depois de reabrir cria uma nova linha.
7. **Histórico** em `month_closing_events` (`CLOSED`, `REOPENED`, ator, nome, motivo, `created_at`), imutável. Nome do ator vem de um leitor de perfil por interface (como o `OwnerReader` de `payment`), gravado como foto no evento.
8. **Rotas** (todas autenticadas, por organização): `GET /closings?month=` (estado, retrato, histórico; mês aberto devolve `status: OPEN` e o retrato **calculado ao vivo** para a tela de conferir), `POST /closings` `{month}`, `POST /closings/{month}/reopen` `{reason}`.
9. **Frontend.** `/financial/receivables/fechamento?mes=`; mês aberto = conferir + diálogo de confirmar; fechado = somente leitura + Reabrir (diálogo com motivo). Recebimentos ganha **Fechar {mês}** (só mês passado aberto) e selo "Mês fechado". PDF = `PrintButton`.

## Risks / Trade-offs

- Cobrança alterada depois de fechada deixa o retrato defasado; o selo mostra a data de fechamento e basta reabrir. Aceito para o MVP.
- Cálculo lê as cobranças do mês inteiro em memória (como o resto do app); se crescer, agregar em SQL.
- Quem pode fechar/reabrir é qualquer usuário da organização com acesso a Recebimentos; permissões finas ficam para o RBAC.

## Migration Plan

Migration 000051 aditiva (duas tabelas novas). Rollback: `down` apaga as tabelas; sem efeito em cobranças.

## Open Questions

Nenhuma bloqueante.
