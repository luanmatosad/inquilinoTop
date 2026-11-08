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
| `/` | **Hoje**: saudação, indicadores e as listas Confirmar pagamento, Atrasados, Para cobrar e Fique de olho (`lib/today-overview.ts`, junção no servidor com as buscas de Recebimentos mais contratos, config Pix e perfil). Conta sem contrato mostra os Primeiros passos. Cobrar e Enviar cobrança levam a `/financial/receivables/{id}?enviar=1`; Revisar reajuste, a `/leases/{id}?reajustar=1`. "Para cobrar" = vence em até 7 dias e sem aviso (não checa envio anterior); reajuste sem percentual (o acumulado do índice não existe) |
| `/login` | Login via Go API |
| `/properties`, `/properties/[id]` | Imóveis (Go API): lista em tabela com indicadores; detalhe em abas (`?aba=unidades\|informacoes`). `/properties/new` e `/properties/[id]/edit` só redirecionam |
| `/tenants`, `/tenants/[id]` | Inquilinos (Go API): lista em tabela com cobrança do mês; detalhe sem abas (`?editar=1` abre a edição) |
| `/leases`, `/leases/[id]` | Contratos (Go API): lista com indicadores; detalhe sem abas (`?editar=1`, `?reajustar=1`, `?encerrar=1`). `/leases?novo=1` abre a criação |
| `/units/[id]` | Detalhe de unidade (Go API): resumo do contrato ativo e "Criar contrato" |
| `/financial/receivables`, `/financial/payables` | Recebimentos e Despesas (Go API): por mês (`?mes=AAAA-MM`), com indicadores e chips (`?situacao=`). `/financial/payables?novo=1` abre o lançamento de despesa |
| `/p/[token]`, `/p/[token]/recibo` | **Página pública da cobrança** (sem login nem menu; o token no endereço é a credencial). Pix com QR e copiar, "Já paguei" (`?avisar=1`), aviso enviado, cobrança paga e recibo. Busca com `goFetch(..., { skipAuth: true })` em `/api/v1/public/payments/{token}`; `notFound()` em 404. Fora do shell (`publicRoutes` em `lib/nav.ts` e `middleware.ts`), `noindex` e `no-referrer`. A server action `reportPayment` repassa multipart (comprovante até 5 MB, `serverActions.bodySizeLimit: 6mb`) |
| `/financial/receivables/[id]` | Detalhe da cobrança (Go API): linha do tempo, valor atualizado, enviar cobrança (`?enviar=1`), registrar pagamento (`?pagar=1`), negociar atraso (`?acordo=1`); `/receipt` é o recibo numerado |
| `/financeiro/dashboard` | Dashboard financeiro (stub) |
| `/financeiro/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` | Financeiro (stub) |
| `/reports`, `/integrations` | Placeholders (`ComingSoon`), com item de menu no canvas e sem tela ainda |
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
- Sem item de menu: Laudos, Importar, Documentos e Fechamento (as rotas `/inspections` e `/import` continuam acessíveis por URL).
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
- **Juros:** a tela usa % ao mês; o backend guarda % ao dia. `monthlyToDaily`/`dailyToMonthly` (`lib/interest.ts`, ÷30 e ×30). Multa 2% e juros 1% ao mês são o padrão fixo do painel.
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
- **Enviar cobrança** (`SendChargeDialog`): a mensagem é montada no cliente (`buildChargeMessage`) com o Pix copia-e-cola dentro do texto, editável; "Abrir WhatsApp" (`whatsappUrl(phone, texto)`) e "Abrir e-mail" (`mailtoUrl`) só abrem o app. O sistema não sabe se foi enviado: "Marcar como enviada" grava o evento (`SENT`, ou `REMINDER` se atrasada).
- **Link público e aviso:** `SendChargeDialog` gera o link (`createPaymentLink` → `POST /payments/{id}/link`); **cada geração revoga o link anterior**. "Aguardando confirmação" é situação derivada (`awaiting_confirmation`, `Situation = 'AWAITING'` só em Recebimentos): chip, selo e ação Confirmar (`ConfirmReportDialog` → `confirmReport`/`rejectReport`). O comprovante do aviso abre por `/api/payments/{id}/proof` (proxy com o token do dono).
- **Pix estático:** `GET /payments/{id}/pix` (backend, `pkg/pix`) com a chave de `/settings/financial`; 422 `PIX_KEY_NOT_CONFIGURED` vira mensagem sem o código. A chave deve estar como no banco (CPF/CNPJ só dígitos, telefone com `+55`); o backend só tira a pontuação de CPF/CNPJ.
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
