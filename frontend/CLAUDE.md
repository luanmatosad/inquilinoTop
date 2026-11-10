# Frontend — Next.js 16 App Router

Auth já migrado para Go (`src/lib/go/client.ts`). Demais domínios ainda usam Supabase.

## Estrutura

```
src/app/                     # Pages + Server Actions (App Router)
src/app/<módulo>/actions.ts  # Server Actions ("use server")
src/components/<módulo>/     # Feature components (forms, lists, dialogs)
src/components/ui/           # Shadcn/UI — NÃO modificar
src/components/today/        # Hoje: TodayKpis, TodayLists (client), GettingStarted
src/data/financeiro/dal.ts   # DAL financeiro (stub/placeholder)
src/lib/go/client.ts         # Cliente HTTP para Go API (goFetch, login, logout, refresh)
src/lib/go/middleware.ts     # Middleware Go auth
src/lib/schemas.ts           # Schemas Zod (propertySchema, unitSchema)
src/lib/supabase/            # client.ts | server.ts | middleware.ts
src/middleware.ts             # Auth: redireciona não-autenticados para /login
```

## Páginas

| Rota | Página |
|---|---|
| `/` | **Hoje**: saudação, indicadores e as listas Confirmar pagamento, Atrasados, Para cobrar e Fique de olho (`lib/today-overview.ts`, junção no servidor com as buscas de Recebimentos mais contratos, config Pix e perfil). Conta sem contrato mostra os Primeiros passos. Cobrar e Enviar cobrança levam a `/financial/receivables/{id}?enviar=1`; Revisar reajuste, a `/leases/{id}?reajustar=1`. "Para cobrar" = vence em até 7 dias e sem aviso (não checa envio anterior); reajuste dentro dos dias de aviso das Regras financeiras (60 por padrão; `buildToday({ readjustNoticeDays })`) e sem percentual (o acumulado do índice não existe) |
| `/login` | Login via Go API |
| `/properties`, `/properties/[id]` | Imóveis (Go API): lista em tabela com indicadores; detalhe em abas (`?aba=unidades\|informacoes`). `/properties/new` e `/properties/[id]/edit` só redirecionam |
| `/settings`, `/settings/*` | **Configurações** com layout próprio (`app/settings/layout.tsx`): menu lateral em `md+` (`components/settings/SettingsNav`) e, no celular, só o conteúdo com "‹ Configurações" voltando à lista (`/settings` = lista das 11 seções do canvas, `lib/settings-nav.ts`). Seções sem tela (Personalização, Plano, Mensagens, Regras, Categorias, Privacidade) aparecem com "Em breve" e sem link. O item "Configurações" do menu abre `/settings/profile`. **Perfil** (`/settings/profile`, e-mail só leitura, CPF/CNPJ e endereço continuam), **Equipe e permissões** (`/settings/team`, papéis do backend: owner/admin/manager/employee/viewer), **Recebimento (Pix)** (`/settings/pix`, Go `GET/PUT /settings/pix` e `PUT/DELETE /settings/pix/units/{unitId}`: chave padrão com tipo, chave, nome (até 25) e cidade (até 15), validadas e normalizadas como no backend (`lib/pix-settings.ts`, CPF/CNPJ com dígito verificador); tabela "Receber em outra conta por imóvel" com painel de edição que exige o checkbox de confirmação (o servidor também exige `confirmed: true`) e tem "Usar chave padrão"; só o dono grava; a chave antiga de `financial_config` aparece como sugestão até salvar; `/settings/financial` só redireciona e provedor, Asaas e dados bancários saíram da tela, sem apagar o que estava gravado), **Mensagens e cobrança** (`/settings/messages`, Go `GET/PUT /settings/reminders`: de 1 a 8 lembretes com nome, dias em relação ao vencimento (únicos, -30 a 60) e texto com as variáveis `{nome} {valor} {vencimento} {imóvel} {mês} {pix} {link}`; o `PUT` substitui a lista inteira, só o dono grava; sem lista gravada valem os 4 padrões do canvas; painel com chips de variáveis que inserem no cursor e prévia com dados da Marina; regras puras em `lib/message-templates.ts`), **Regras financeiras** (`/settings/rules`, Go `GET/PUT /settings/financial-rules`: multa 0 a 10%, juros 0 a 5% ao mês, índice `IGP-M`/`IPCA`, dias de aviso do reajuste 1 a 180; só o dono grava, `org:update`; valem para **novos contratos** e definem a janela do reajuste em Hoje, padrão 60; sem carência; regras puras em `lib/financial-rules.ts`; o bloco antigo "Padrões de Cobrança" saiu de Recebimento), **Notificações** (`/settings/notifications`, 3 avisos; `/owner/settings` só redireciona; o `PUT` substitui tudo, então `buildPreferencesPayload` devolve os campos que a tela não mostra, e a action **não grava** se não conseguir ler as preferências atuais; nada no backend lê essas preferências ainda) e **Segurança** (`/settings/security`: trocar senha e 2FA em 3 passos: `startTwoFactor` → QR e chave, `confirmTwoFactor` → códigos de recuperação mostrados **uma vez**, `disableTwoFactor` com a senha; o estado vem de `two_factor_enabled` em `GET /auth/profile`) |
| `/tenants`, `/tenants/[id]` | Inquilinos (Go API): lista em tabela com cobrança do mês; detalhe com abas Resumo e Extrato (`?editar=1` abre a edição) |
| `/tenants/[id]/extrato` | **Extrato do inquilino**: só aluguel (`RENT`) de todos os contratos, uma busca `GET /payments?lease_id&from&to` por contrato. Período por URL (`?periodo=12m\|AAAA\|custom&de&ate`, padrão 12 meses até o fim do mês corrente), indicadores Recebido/Pontualidade/Em atraso agora ou Atrasos, 6 linhas e `?todos=1`, Contrato, Reajustes e Acordos (`original_due_date`). Exportar PDF = impressão do navegador; Cobrar → cobrança aberta mais antiga `?enviar=1`. Regras em `lib/tenant-statement.ts`. Sem aba Documentos |
| `/leases`, `/leases/[id]` | Contratos (Go API): lista com indicadores; detalhe sem abas (`?editar=1`, `?reajustar=1`, `?encerrar=1`). `/leases?novo=1` abre a criação |
| `/units/[id]` | Detalhe de unidade (Go API): resumo do contrato ativo e "Criar contrato" |
| `/financial/receivables`, `/financial/payables` | Recebimentos e Despesas (Go API): por mês (`?mes=AAAA-MM`), com indicadores e chips (`?situacao=`). `/financial/payables?novo=1` abre o lançamento de despesa |
| `/p/[token]`, `/p/[token]/recibo` | **Página pública da cobrança** (sem login nem menu; o token no endereço é a credencial). Pix com QR e copiar, "Já paguei" (`?avisar=1`), aviso enviado, cobrança paga e recibo. Busca com `goFetch(..., { skipAuth: true })` em `/api/v1/public/payments/{token}`; `notFound()` em 404. Fora do shell (`publicRoutes` em `lib/nav.ts` e `middleware.ts`), `noindex` e `no-referrer`. A server action `reportPayment` repassa multipart (comprovante até 5 MB, `serverActions.bodySizeLimit: 6mb`) |
| `/financial/receivables/fechamento` | **Fechamento do mês** (`?mes=AAAA-MM`; Go `GET /closings?month=`): mês aberto mostra Previsto/Recebido/Em atraso, "Antes de fechar" (avisos confirmados, recibos, cobranças em atraso com nomes) e **Fechar {mês}** (só mês passado; pendências não bloqueiam); mês fechado é somente leitura (quem e quando fechou, pendências, histórico) com **Reabrir mês** (motivo obrigatório). Resumo em PDF = impressão do navegador. Recebimentos de mês passado mostra **Fechar {mês}** ou o selo **Mês fechado** (`lib/month-closing.ts`, `ClosingActions`, actions `closeMonth`/`reopenMonth`). O fechamento não trava as cobranças: só o retrato é imutável |
| `/financial/receivables/[id]` | Detalhe da cobrança (Go API): linha do tempo, valor atualizado, enviar cobrança (`?enviar=1`), registrar pagamento (`?pagar=1`), negociar atraso (`?acordo=1`); `/receipt` é o recibo numerado |
| `/financeiro/dashboard` | Dashboard financeiro (stub) |
| `/financeiro/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` | Financeiro (stub) |
| `/reports`, `/reports/por-imovel` | **Relatórios** (Go `GET /reports/overview` e `/reports/by-property`, base de caixa: por data de pagamento, líquido; só meses completos): hub com seletor de ano (`?ano=`, 2020 até o corrente), Recebido/Despesas/Resultado, gráfico mensal (`MonthlyChart`, `ui/chart`; no celular sem gráfico) e cards Por imóvel e Inadimplência (→ `/financial/receivables?situacao=LATE`); Por imóvel com tabela e total (cards no celular) e **Exportar planilha** (`GET /api/reports/por-imovel?ano=`, CSV UTF-8 com BOM, `;` e vírgula decimal). Rótulo "Unidade · Imóvel" vem de `/properties` (`—` se falhar). Regras em `lib/report-overview.ts`. Pode diferir do Fechamento (por vencimento, bruto) |
| `/reports/carne-leao` | **Carnê-leão e DIRPF** (Go `GET /reports/carne-leao?month=`): `?mes=AAAA-MM` entre 2020 e o último mês encerrado (padrão: mês anterior em São Paulo, `lib/carne-leao.ts`), navegação de mês, faixa de estado do Fechamento (`GET /closings`: fechado mostra o prazo, aberto leva ao Fechamento, falha mostra só o aviso do cálculo), totais Rendimentos de aluguel/Despesas que entram/Base estimada (nunca negativa), listas Quem pagou (só inquilino PF) e Despesas que entram (só Impostos e Condomínio, fixas no backend). **Baixar para o contador** = impressão do navegador; **Exportar planilha** = `GET /api/reports/carne-leao?mes=` (CSV com as duas listas e a base). Números por data de pagamento, não os do Fechamento. O card do hub aponta para o mês anterior |
| `/integrations` | Placeholder (`ComingSoon`), com item de menu no canvas e sem tela ainda |
| `/support`, `/support/tickets`, `/support/tickets/[id]`, `/support/new-ticket`, `/support/contacts` | Suporte |

## Medidas do canvas nos componentes base

O canvas é a fonte da verdade (spec `ui-primitives`). Os `ui/*` já trazem as medidas; **não** compense na tela com classes de altura ou espaçamento.

- **Fonte:** Urbanist no `<html>` (variáveis `--font-urbanist` e `--font-space-mono` ficam no `<html>`, senão o Tailwind cai na fonte do sistema); `<body>` usa `font-sans`.
- **Input e Select:** 44px no celular, 36px a partir de `md`; raio 6, borda e `shadow-xs`.
- **Button padrão:** 44px no celular, 32px a partir de `md`. Não use `h-11` nos botões de rodapé fixo.
- **Card:** raio 12, borda, `shadow-sm`, 16px de espaçamento; `size="flush"` para moldura de tabela (sem `p-0 gap-0`).
- **Table:** cabeçalho 12px/500 em `muted`, células 12×16, linha de 56px.
- **Sheet lateral:** 440px (cheio abaixo de `sm`), 24px de padding (`p-6` no cabeçalho, `px-6 pb-6` no corpo).
- **Badge:** 20px, pílula. **Chip** (filtros por URL): 28px a partir de `md`, 32px no celular, 13px/500. **Título da página:** `text-2xl font-semibold leading-[1.2]`.

## Shell e navegação

O canvas "ImoviFlow — Telas" é a fonte da verdade da navegação (change `redesign-foundation`).

- `src/lib/nav.ts`: única definição. 3 grupos (Gestão: Hoje, Imóveis, Inquilinos, Contratos · Financeiro: Recebimentos, Despesas, Relatórios · Administrativo: Integrações, Configurações). Itens com `mobileTab` viram abas da barra inferior; os demais caem em "Mais" (`moreItems`).
- Sem item de menu: Laudos, Importar, Documentos e Fechamento (esta fica em Recebimentos, no botão Fechar {mês}). Na paleta ⌘K o Perfil é o item "Configurações" (hrefs únicos em `commandGroups`) (as rotas `/inspections` e `/import` continuam acessíveis por URL).
- `AppShell` → `AppSidebar` (servidor: carrega organização e perfil) → `Sidebar` (desktop) + `MobileTabBar` (celular, `md:hidden`). Não há modo visitante: sem sessão, o middleware redireciona para `/login`.
- Tokens em `src/app/globals.css` espelham o `tokens.json` do canvas (claro e escuro). Fontes: Urbanist e Space Mono, self-hosted via `@fontsource`.

## Imóveis (redesign)

- **Painéis por URL:** `/properties?novo=1` abre o cadastro de imóvel; no detalhe, `?unidade=nova` ou `?unidade=<id>` abre o de unidade (`PropertyFormSheet`, `UnitFormSheet`). Fechar tira só o parâmetro da URL.
- **Ocupação** (alugada/vaga, inquilino, "desde"): função pura `src/lib/property-occupancy.ts`, que junta imóveis + contratos `ACTIVE` + inquilinos no servidor Next. Contratos fora do ar degradam para "—" em vez de derrubar a tela. `/leases` e `/tenants` não paginam, então se a base crescer essa regra deve migrar para o backend.
- **Tipos:** `RESIDENTIAL`, `COMMERCIAL` e `SINGLE` (rótulo "Casa"). "Terreno" do canvas mobile não existe no domínio.
- **Endereço:** `number` e `complement` são colunas próprias; `formatPropertyAddress` compõe o texto de exibição.
- Fora desta etapa: preenchimento do endereço pelo CEP, abas Despesas e Recebimento do detalhe.

## Inquilinos (redesign)

- **Painéis por URL:** `/tenants?novo=1` abre o cadastro; no detalhe, `?editar=1` abre a edição, com "Excluir inquilino" no rodapé (`TenantFormSheet`). Quem tem contrato ativo não pode ser excluído (`TENANT_HAS_ACTIVE_LEASE`).
- **`PUT /tenants/{id}` é substituição total:** o que o corpo omite vira `NULL`. O formulário rápido não mostra endereço, então a edição devolve o endereço gravado com `preserveAddress` (`lib/tenant-form.ts`). Nunca remova isso sem mudar o backend.
- **Situação de cobrança** (Atrasado, Pago, Previsto, Sem contrato): `buildTenantOverview` (`lib/tenant-overview.ts`) junta inquilinos, contratos `ACTIVE`, imóveis e pagamentos no servidor Next. Busca o mês corrente (`/payments?from&to`, fuso `America/Sao_Paulo`) e os atrasados (`/payments?status=LATE`). Atraso de qualquer mês vence o resto; só `RENT` decide Pago/Previsto. Falha de contratos, imóveis ou pagamentos degrada para "—" com aviso. Nenhuma lista pagina: se a base crescer, mover para o backend.
- **Documento:** CPF/CNPJ aparece mascarado (`maskDocumentPartial`) na lista e no detalhe, e a máscara é aplicada **no servidor**. O documento completo só chega ao navegador no formulário de edição aberto.
- **Fora desta etapa:** Fiador (vai com Contratos), "Aguardando confirmação"/"Confirmar pagamento" (fluxo 04), abas Extrato e Documentos, próximo reajuste. O histórico de contratos do inquilino passou a viver em Contratos.

## Contratos (redesign)

- **Painéis por URL:** `/leases?novo=1` (aceita `&inquilino=<id>` e `&unidade=<id>`) abre a criação; no detalhe, `?editar=1` (`LeaseFormSheet`), `?reajustar=1` (`ReadjustSheet`) e `?encerrar=1` (`EndLeaseDialog`, modal). Fechar tira só o parâmetro. Não há Renovar nem aditivo (o aditivo é a change futura `contrato-aditivo`).
- **`PUT /leases/{id}` é substituição total:** a action `updateLease` lê o contrato atual no servidor e devolve o que a tela não mostra (caução, ano do IPTU, status) com `preserveLeaseFields` (`lib/lease-form.ts`). Nunca remova isso sem mudar o backend.
- **Juros:** a tela usa % ao mês; o backend guarda % ao dia. `monthlyToDaily`/`dailyToMonthly` (`lib/interest.ts`, ÷30 e ×30). Multa, juros e índice do contrato **novo** vêm das Regras financeiras (`contractDefaults`; sem elas, 2%, 1% e nenhum índice); a edição usa os valores do contrato.
- **Próx. reajuste:** vem calculado do backend (`next_readjustment`, dia 1). "Pendente" = mês anterior ao corrente; "Reajuste em 90 dias" = do início do mês corrente até hoje+90 (`lib/lease-overview.ts`, fuso `America/Sao_Paulo`).
- **Reajuste atualiza as cobranças futuras** `PENDING` sem cobrança emitida (ADR payment-0004); o painel mostra quantas foram atualizadas e quantas precisam de revisão.
- **Encerrar:** corpo `{end_date, reason}`; a data nunca estende o prazo e cobranças pendentes depois dela são canceladas.
- **Contrato assinado:** upload por rota Next (`/api/leases/[id]/documents`, PDF/DOC/DOCX até 10 MB) e download por `/api/documents/[id]`, ambos repassando o token httpOnly.
- **Aluguel de referência** da unidade (`reference_rent`) sugere o aluguel ao criar o contrato ("Sugerido pela unidade.").

## Financeiro (redesign)

- **Mês por URL:** `?mes=AAAA-MM` (padrão: mês corrente em `America/Sao_Paulo`, `parseMonth` em `lib/financial-overview.ts`); `MonthNav` mantém `?situacao=` ao trocar.
- **Quais linhas:** cobranças `RENT` (ou despesas) com vencimento no mês **mais** as `LATE` de qualquer mês, unidas sem repetir (duas buscas por tela). Os indicadores somam as linhas exibidas, não o `/summary` do backend. Em Recebimentos o "Em atraso" é o valor bruto; o total com multa e juros só aparece no diálogo de pagamento.
- **Situação:** Recebimentos tem Atrasado, Pago e Previsto; Despesas tem Atrasada, Paga e A pagar, e o chip "A pagar" inclui as atrasadas (`filterPayables`).
- **Ações:** Registrar pagamento (`ReceivablesList`, `payReceivable`) e Recibo; Dar baixa e Desfazer pagamento (`PayablesList`, `payExpense`/`unpayExpense`); Lançar despesa em painel (`ExpenseFormSheet`, `createPayable`). "Já paguei" manda `paid_date` e o backend cria a despesa já `PAID` numa só operação.
- **Fora desta etapa:** Aguardando confirmação, Confirmar, Cobrar e Enviar cobrança (fluxo 04), Exportar, repetir todo mês, comprovante, despesa de imóvel inteiro e categorias editáveis (a categoria "Limpeza" do canvas não existe no enum). A baixa em lote foi removida porque o canvas não a prevê.
- `ExpenseDialog` e `ExpenseList` continuam em `/units/[id]` com a action antiga `createExpense`.

## Ciclo de cobrança manual (cobranca-manual)

- **Só o dono, sem página pública.** O link do inquilino, "já paguei", Aguardando confirmação e Confirmar são a onda B.
- **Enviar cobrança** (`SendChargeDialog`): a mensagem vem do **modelo do lembrete** que combina com os dias até o vencimento (`pickReminder`: maior `offset_days` menor ou igual aos dias desde o vencimento; se está mais cedo que todos, o primeiro), preenchido por `renderTemplate`/`chargeVariables` (`{link}` = link se já gerado, senão o Pix; `{pix}` sempre o código; variável vazia não deixa sobra) e mostra "Modelo: {nome}"; se os lembretes não carregarem, usa `buildChargeMessage` (texto fixo) com o Pix copia-e-cola dentro do texto, editável; "Abrir WhatsApp" (`whatsappUrl(phone, texto)`) e "Abrir e-mail" (`mailtoUrl`) só abrem o app. O sistema não sabe se foi enviado: "Marcar como enviada" grava o evento (`SENT`, ou `REMINDER` se atrasada).
- **Link público e aviso:** `SendChargeDialog` gera o link (`createPaymentLink` → `POST /payments/{id}/link`); **cada geração revoga o link anterior**. "Aguardando confirmação" é situação derivada (`awaiting_confirmation`, `Situation = 'AWAITING'` só em Recebimentos): chip, selo e ação Confirmar (`ConfirmReportDialog` → `confirmReport`/`rejectReport`). O comprovante do aviso abre por `/api/payments/{id}/proof` (proxy com o token do dono).
- **Pix estático:** `GET /payments/{id}/pix` (backend, `pkg/pix`) com a chave de `/settings/financial`; 422 `PIX_KEY_NOT_CONFIGURED` vira mensagem sem o código. A chave vem da conta da unidade, da organização (Configurações > Recebimento) ou da chave antiga, nessa ordem; a configuração nova já grava normalizada (CPF/CNPJ só dígitos, telefone `+55...`). A página pública mostra "Pague para {nome}" (`receiver_name`).
- **Linha do tempo** (`buildTimeline`): eventos do backend (`SENT`, `REMINDER`, `AGREEMENT`, `PAID`) mais os marcos calculados Criada e Venceu em. "por você" compara `actor_id` com o `owner_id` do JWT (`sessionUserId`, só para rotular).
- **Registrar pagamento** (`RegisterPaymentDialog`): forma, desconto e observação; o valor é sempre o total devido (sem pagamento parcial). O limite do desconto é o total devido hoje; o backend confere de novo (`INVALID_DISCOUNT`).
- **Negociar atraso** (`AgreementSheet`): nova data e valor combinado; troca `due_date` e `gross_amount` e preserva o original no evento. Sem Parcelar nem pausar lembretes.
- **Recibo:** número `0001/2026` vem do backend; valor por extenso em `lib/valor-por-extenso.ts`; "Baixar PDF" é `window.print()` (o usuário escolhe "Salvar como PDF").

## Auth — MIGRADO para Go

`src/lib/go/client.ts`: `goFetch<T>` (wrapper com Bearer token + refresh automático), `login`, `register`, `logout`, `getCurrentUser`.

Tokens armazenados em cookies httpOnly (`access_token`, `refresh_token`). `goFetch` faz refresh automático em 401.

`src/app/auth/actions.ts` usa `goLogin`/`goRegister`/`goLogout` — não Supabase.

## Server Actions Pattern

Todas as actions em `src/app/<módulo>/actions.ts`:
1. `"use server"` no topo
2. Validar com Zod (`schema.safeParse`)
3. Chamar Go API (`goFetch`) ou Supabase (legado)
4. `revalidatePath("/rota")`

## Status de Migração por Domínio

| Domínio | Go Backend | Frontend |
|---|---|---|
| identity/auth | ✓ | **MIGRADO** — usa `src/lib/go/client.ts` |
| property + unit | ✓ | ainda Supabase |
| tenant | ✓ | ainda Supabase |
| lease | ✓ | **MIGRADO** — Go API |
| payment | ✓ | ainda Supabase |
| expense | ✓ | ainda Supabase |
| support | ✓ | ainda Supabase (actions em `/support/actions.ts`) |
| financeiro | ✓ (fiscal) | stub — sem DAL real ainda |

## Gotchas

- `goFetch` retorna `(data as { data: T }).data` — unwrap do envelope `{"data": ...}`.
- `goFetch` com `skipAuth: true` não adiciona Authorization header — usado em login/register/refresh.
- O financeiro antigo (`/financial/dashboard` e afins) ainda é stub; Hoje e Recebimentos/Despesas usam a Go API.
- Schemas Zod em `schemas.ts` só cobrem property e unit.

## Decisões

- [cross-cutting-0002](../docs/decisions/_cross-cutting/0002-shadcn-ui-unica-biblioteca.md): shadcn/ui é a única biblioteca de UI; `@heroui/*` bloqueado por lint.
