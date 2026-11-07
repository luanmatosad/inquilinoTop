# Frontend — Next.js 16 App Router

Auth já migrado para Go (`src/lib/go/client.ts`). Demais domínios ainda usam Supabase.

## Estrutura

```
src/app/                     # Pages + Server Actions (App Router)
src/app/<módulo>/actions.ts  # Server Actions ("use server")
src/components/<módulo>/     # Feature components (forms, lists, dialogs)
src/components/ui/           # Shadcn/UI — NÃO modificar
src/components/dashboard/    # StatsCards, FinancialSummary, RecentActivity
src/data/dashboard/dal.ts    # Data Access Layer — queries Supabase para dashboard
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
| `/` | Dashboard |
| `/login` | Login via Go API |
| `/properties`, `/properties/[id]` | Imóveis (Go API): lista em tabela com indicadores; detalhe em abas (`?aba=unidades\|informacoes`). `/properties/new` e `/properties/[id]/edit` só redirecionam |
| `/tenants`, `/tenants/[id]` | Inquilinos (Go API): lista em tabela com cobrança do mês; detalhe sem abas (`?editar=1` abre a edição) |
| `/leases`, `/leases/[id]` | Contratos (Go API): lista com indicadores; detalhe sem abas (`?editar=1`, `?reajustar=1`, `?encerrar=1`). `/leases?novo=1` abre a criação |
| `/units/[id]` | Detalhe de unidade (Go API): resumo do contrato ativo e "Criar contrato" |
| `/financeiro/dashboard` | Dashboard financeiro (stub) |
| `/financeiro/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` | Financeiro (stub) |
| `/reports`, `/integrations` | Placeholders (`ComingSoon`), com item de menu no canvas e sem tela ainda |
| `/support`, `/support/tickets`, `/support/tickets/[id]`, `/support/new-ticket`, `/support/contacts` | Suporte |

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
- Dashboard e financeiro usam Supabase diretamente — não há DAL para Go ainda.
- Schemas Zod em `schemas.ts` só cobrem property e unit.

## Decisões

- [cross-cutting-0002](../docs/decisions/_cross-cutting/0002-shadcn-ui-unica-biblioteca.md): shadcn/ui é a única biblioteca de UI; `@heroui/*` bloqueado por lint.
