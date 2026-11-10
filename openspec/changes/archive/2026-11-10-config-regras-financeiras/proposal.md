## Why

A tela de Configurações guarda "multa padrão" e "juros padrão" (`financial_config.config`), mas **nada lê esses valores**: o formulário de contrato usa 2% e 1% fixos, e Hoje avisa o reajuste com 30 dias fixos. O canvas (`Configuracoes-regras`) trata isso como uma seção própria, "Regras financeiras", que vale para novos contratos.

## What Changes

- Backend: tabela `organization_settings` (uma linha por organização) e `GET/PUT /settings/financial-rules` com multa, juros ao mês, índice de reajuste padrão e dias de aviso do reajuste. Sem linha, a API devolve os padrões (2%, 1%, IGP-M, 60 dias). A migration copia os valores antigos de `default_late_fee` e `default_interest`, quando válidos.
- Frontend: tela `/settings/rules` (Regras financeiras, sai do "Em breve"); o formulário de **novo contrato** passa a vir com esses padrões; **Hoje** usa os dias de aviso do reajuste (padrão 60, antes 30).
- O bloco "Padrões de Cobrança" some da tela de Recebimento (Pix), porque agora vive em Regras financeiras.
- Fora: dias de carência (mudaria o que é "atrasada" no sistema todo), a opção "Reajustar no", contratos já existentes, Pix (change `config-pix`).

## Capabilities

### New Capabilities
- `financial-rules`: padrões financeiros da organização (API, tela e uso em novo contrato).

### Modified Capabilities
- `today-overview`: a janela do aviso de reajuste deixa de ser 30 dias fixos e passa a ser a das Regras financeiras.

## Impact

- Backend: novo `internal/settings` (4 arquivos), migration 000052, `cmd/api/main.go`, Swagger, `CLAUDE.md`.
- Frontend: `app/settings/rules`, `lib/financial-rules.ts`, `lib/settings-nav.ts`, `LeaseFormSheet`/`LeaseForm` (padrões de novo contrato), `app/leases/page.tsx`, `app/page.tsx` e `lib/today-overview.ts` (janela), `FinancialForm`/action de Recebimento (remove o bloco antigo).
- Comportamento: Hoje passa a avisar o reajuste 60 dias antes (antes 30) para quem não configurar nada.
