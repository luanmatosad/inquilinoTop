## Context

Canvas `Configuracoes-regras`: Multa por atraso 2%, Juros ao mês 1%, Dias de carência 0, Índice de reajuste padrão IGP-M ("você revisa e aprova cada reajuste antes de valer"), Reajustar no "aniversário do contrato", "Avisar quando faltar 60 dias para o reajuste" ("O aviso aparece em Hoje"), com a nota "Valem para novos contratos. Dá para mudar em cada contrato.". Verificado: `financial_config.config` guarda `default_late_fee`/`default_interest` e **só o próprio formulário os lê**; `LeaseForm` fixa `late_fee_percent: '2'`, `monthly_interest_percent: '1'`, `adjustment_index: ''`; índices do contrato: `IGP-M` e `IPCA`; `READJUST_WINDOW_DAYS = 30` em `lib/today-overview.ts`; permissões `org:read` e `org:update`.

## Goals / Non-Goals

**Goals:** fazer os padrões valerem de verdade (novo contrato e Hoje); uma tela só para eles.
**Non-Goals:** carência (a definição de "atrasada" está em SQL em vários módulos), "Reajustar no", mudar contratos existentes, Pix.

## Decisions

1. **Tabela tipada `organization_settings`** (`organization_id` PK, `late_fee_percent NUMERIC(5,2)`, `monthly_interest_percent NUMERIC(5,2)`, `default_adjustment_index TEXT`, `readjust_notice_days INT`, `updated_at`, `updated_by`) com `CHECK`s: multa 0 a 10, juros 0 a 5, índice em (`IGP-M`, `IPCA`), aviso 1 a 180. Outras ondas (mensagens) estendem a mesma tabela. A migration cria a tabela e copia, por organização com `financial_config` ativo, `default_late_fee` e `default_interest` **só se forem números dentro da faixa**; o resto fica no padrão.
2. **Rotas** `GET /settings/financial-rules` (permissão `org:read`) e `PUT /settings/financial-rules` (`org:update`), escopo por organização. `GET` sem linha devolve `{late_fee_percent: 2, monthly_interest_percent: 1, default_adjustment_index: "IGP-M", readjust_notice_days: 60}`. `PUT` é upsert, valida as faixas (400 `INVALID_RULES` com o campo) e devolve o estado salvo. Os valores saem como número, não texto.
3. **Novo contrato.** `app/leases/page.tsx` busca as regras (junto com o resto, `Promise.allSettled`) e passa `defaults` ao `LeaseFormSheet`; `LeaseForm` usa `defaults` só ao **criar** (edição usa o que o contrato tem). Se a busca falhar (ou o papel não tiver `org:read`), cai nos padrões fixos de hoje (2, 1, sem índice) sem avisar o usuário.
4. **Índice padrão no contrato.** O seletor de novo contrato já vem com o índice das regras. A tela de Regras explica que o reajuste continua sendo revisado por contrato.
5. **Hoje.** `buildToday` recebe `readjustNoticeDays` (padrão 60 se a busca falhar) no lugar da constante; "ending" continua 60 dias. É a única mudança de comportamento visível: quem não configurar nada passa a ver reajustes 60 dias antes (hoje 30), como o canvas pede.
6. **Tela `/settings/rules`.** Quatro campos (multa %, juros % ao mês, índice, dias de aviso) com validação Zod igual às faixas do backend, salvando por server action; texto "Valem para novos contratos. Dá para mudar em cada contrato." e "O aviso aparece em Hoje". Sem o campo de carência e sem "Reajustar no". A seção "Regras financeiras" do menu ganha link.
7. **Recebimento (Pix).** O bloco "Padrões de Cobrança" sai de `FinancialForm`; a action para de gravar `default_late_fee`/`default_interest` (a migration já copiou os valores válidos). O resto do formulário não muda (a change `config-pix` cuida dele).

## Risks / Trade-offs

- Hoje avisa o reajuste mais cedo por padrão (60 em vez de 30); quem quiser 30 ajusta na tela.
- Quem tinha valores fora da faixa em `default_late_fee`/`default_interest` volta ao padrão (eles nunca valeram).
- Papéis sem `org:read` criam contrato com os padrões fixos antigos até o papel ganhar a permissão.
- Duas tabelas de configuração (`financial_config` e `organization_settings`) convivem até a onda do Pix.

## Migration Plan

Migration 000052 aditiva (tabela nova e cópia). Rollback: `down` apaga a tabela; `financial_config` não é alterado.

## Open Questions

Nenhuma bloqueante.
