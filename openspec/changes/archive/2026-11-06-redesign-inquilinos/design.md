## Context

Telas do canvas: `Inquilinos-vazia`, `Inquilinos-lista`, `Inquilinos-cadastrar` (painel), `Inquilino-detalhe`, `Inquilino-detalhe-sem-contrato`, `Inquilino-editar` (painel), `M-Inquilinos`, `M-Inquilino-cadastrar`, `M-Inquilino-detalhe`. Estado atual, verificado no repo:

- **Backend `tenant`:** `Tenant` tem `name`, `email`, `phone`, `document`, `person_type`, `postal_code`, `address_line`, `city`, `state`, `notes`. `POST`/`PUT`/`DELETE`/`GET` em `/tenants`. O `PUT` é substituição total: `UPDATE ... SET postal_code=$6, address_line=$7, city=$8, state=$9 ...` grava `NULL` em tudo que o corpo omite. Excluir inquilino com contrato `ACTIVE` devolve 409 (`ErrHasActiveLease`).
- **Pagamentos:** `GET /api/v1/payments` aceita `from`/`to` (vencimento, inclusive), `status` (`PENDING`, `LATE`, `PAID`) e `lease_id`. `LATE` é calculado pelo serviço na listagem (vencida e não paga), não gravado.
- **Contratos e imóveis:** `Lease` tem `tenant_id`, `unit_id`, `status`, `start_date`, `rent_amount`, `payment_day`. `/properties` devolve imóveis com suas unidades. Nenhuma das listas pagina.
- **Frontend:** `TenantListClient` (cliente, `Dialog` para criar/editar/excluir), `TenantForm` (com CEP, endereço, cidade, UF), `[id]/page.tsx` com a lista de contratos. `tenantSchema` em `lib/schemas.ts`; máscaras em `lib/masks.ts`.
- **Padrão da onda anterior (Imóveis):** painel `Sheet` controlado pela URL, junção no servidor por função pura, degradação quando uma busca opcional falha, tabela no desktop e cards no celular.

## Goals / Non-Goals

**Goals:**
- Telas de Inquilinos fiéis ao canvas, no desktop e no celular, reaproveitando os padrões de Imóveis.
- Situação de cobrança correta e legível por inquilino, sem mudar o backend.
- CPF/CNPJ nunca completo em componentes cliente fora da edição.
- Editar um inquilino nunca apaga o endereço já gravado.

**Non-Goals:**
- Fiador, "Aguardando confirmação", "Confirmar pagamento", Extrato, Documentos, próximo reajuste.
- Mudanças em `tenant`, `lease` ou `payment` no Go.
- Importar em massa (só o botão que leva a `/import`).
- Paginação das listas.

## Decisions

**1. Só frontend.**
Tudo que o canvas mostra e o backend suporta vem de endpoints existentes. As quatro lacunas (fiador, aguardando confirmação, próximo reajuste, abas) ficam fora e documentadas, em vez de criar backend especulativo.

**2. Junção no servidor Next, em função pura `buildTenantOverview`.**
`src/lib/tenant-overview.ts` recebe inquilinos, contratos, imóveis (com unidades) e pagamentos e devolve, por inquilino: contrato atual, unidade e imóvel, e situação de cobrança. Buscas em paralelo (`Promise.allSettled`): `/tenants` (obrigatória), `/leases`, `/properties`, `/payments?from&to` (mês corrente) e `/payments?status=LATE`. Regras:
- Contrato atual = contrato `ACTIVE` do inquilino de `start_date` mais recente.
- Imóvel e unidade: `unit_id` do contrato → unidade e imóvel pelo mapa de `/properties`.
- Situação de cobrança, nesta ordem: sem contrato ativo → **Sem contrato**; existe pagamento `LATE` em contrato ativo do inquilino (qualquer mês) → **Atrasado**; pagamento `RENT` do mês corrente `PAID` → **Pago**; `PENDING` → **Previsto**; sem pagamento no mês → sem situação ("—").
- "Mês corrente" usa o fuso `America/Sao_Paulo`, o mesmo padrão do backend (`APP_TIMEZONE`).
Alternativa descartada: um endpoint novo no Go que já devolva a visão consolidada. É mais correto e mais barato para listas grandes, mas é uma feature a mais; a função pura migra para o Go quando o volume pedir.

**2a. Degradação.** Inquilinos é obrigatório (falha vira erro da tela). Se contratos ou imóveis falharem, "Imóvel e unidade" e "Cobrança do mês" aparecem como "—" com aviso discreto. Se só os pagamentos falharem, só a cobrança fica "—".

**3. Painel lateral por URL, como em Imóveis.**
`/tenants?novo=1` abre o cadastro; no detalhe, `/tenants/[id]?editar=1` abre a edição. O canvas só edita a partir do detalhe, então a lista não tem ação de editar. Um único `TenantFormSheet` serve aos dois usos. Estado local para fechar na hora e ajuste de estado na renderização (sem `setState` em `useEffect`).

**4. Formulário rápido sem endereço, mas sem perder dados.**
Campos do canvas: Tipo (Pessoa física/Empresa), Nome completo (ou Razão social), CPF (ou CNPJ), E-mail, Celular (WhatsApp) com a dica "É por aqui que você envia as cobranças.", Observações. O cadastro novo não envia endereço. A **edição repassa** `postal_code`, `address_line`, `city` e `state` de `initialData` em campos ocultos do formulário, de modo que o `PUT` devolve os valores antigos. `tenantSchema` não muda (os campos seguem opcionais). Alternativa descartada: mudar o backend para `PATCH` ou para ignorar campos omitidos; é mais limpo, mas muda um contrato de API usado por outras telas e pela importação.

**5. Documento mascarado no servidor.**
`maskDocumentPartial(document, personType)`: CPF `123.456.***-09`, CNPJ `12.345.***/0001-90`. A página de servidor aplica a máscara ao montar as linhas, e só o texto mascarado cruza para componentes cliente. O documento completo só viaja para o navegador no formulário de edição (que precisa dele), e apenas com o painel de edição aberto.

**6. Exclusão no rodapé do painel de edição.**
Botão "Excluir inquilino" com `AlertDialog`. O erro 409 `ErrHasActiveLease` vira "Este inquilino tem contrato ativo. Encerre o contrato antes de excluir." Depois de excluir, volta para `/tenants`. Exclusão continua lógica.

**7. Detalhe sem abas.**
Extrato (fluxo 07) e Documentos (fluxo 11) não existem; abas com um único item não fazem sentido. O conteúdo é uma grade de cartões: Cobrança do mês, Contrato atual, Observações, Contato. Com contrato: "Ver cobrança" leva a `/financial/receivables` e "Ver contrato" a `/leases/<id>`. Sem contrato: selo "Sem contrato", cartão com "Para gerar cobranças, ligue este inquilino a uma unidade." e o botão "Criar contrato" levando a `/leases`, até a onda de Contratos oferecer um destino melhor.

**8. WhatsApp.**
`whatsappUrl(phone)` normaliza para dígitos, acrescenta o `55` quando faltar e devolve `https://wa.me/55DDDNÚMERO`; telefone inválido não gera botão. Abre em nova aba com `rel="noopener noreferrer"`.

**9. Filtro por situação de cobrança.**
O botão "Filtros" filtra por Todos, Atrasado, Previsto, Pago e Sem contrato (`?cobranca=`), porque a pergunta mais comum é "quem está atrasado". Busca por nome, e-mail ou documento (só dígitos) em `?q=`.

**10. Mobile na mesma página.** Abaixo de `md`, cards e painel em tela cheia, como em Imóveis. Detalhes do desenho saem de `M-Inquilinos`, `M-Inquilino-cadastrar` e `M-Inquilino-detalhe` na primeira tarefa.

**11. Limpeza.** `TenantListClient` e o `TenantForm` antigo saem. Não há rota `/tenants/new` ou `/edit` para redirecionar, porque a criação e a edição atuais são `Dialog`.

## Risks / Trade-offs

- [`PUT` apaga campos omitidos] → Repasse dos valores antigos na edição, coberto por teste que confere o corpo enviado.
- [Documento completo vazando para o navegador] → Máscara no servidor e teste de que a lista não contém o documento completo; o completo só no formulário de edição.
- [5 buscas sem paginação] → Aceitável no porte atual; a função pura isola a regra. Se passar de alguns milhares de registros, mover para o backend. Registrado como dívida.
- [`LATE` é calculado na listagem] → A regra usa o que o backend devolve; um pagamento vencido sem cobrança gerada não aparece. Conferir na primeira tarefa se `status=LATE` já considera a data de hoje.
- [Fuso do "mês corrente"] → Constante `America/Sao_Paulo` e teste na virada do mês.
- [Pagamentos de tipos diferentes no mesmo mês] → "Pago/Previsto" considera só `RENT`; `LATE` considera qualquer tipo do contrato ativo.
- [Sem histórico de contratos no detalhe] → Perda deliberada, o histórico vive em Contratos; registrado no proposal.
- [Preset `shadcnds` (radix-nova) × frontend (new-york)] → Conferir no navegador, como em Imóveis.

## Migration Plan

Sem migration nem mudança de API. O deploy do frontend é suficiente; reverter é reverter o frontend.

## Decisões da leitura do canvas (tarefas 1.1 a 1.3)

- **Estado vazio (`Inquilinos-vazia`):** a busca, "Filtros", "Importar" e "Cadastrar inquilino" continuam visíveis; abaixo, bloco `muted` com ícone, "Cadastre seu primeiro inquilino", "Para começar, só precisa de nome e contato. O contrato vem depois." e botão outline "Cadastrar inquilino".
- **Lista mobile (`M-Inquilinos`):** linha-resumo "6 inquilinos", busca, cards com nome, "Unidade · Imóvel" (ou "Sem contrato") e o selo da cobrança à direita ("—" sem contrato); botão fixo "Cadastrar inquilino". **Sem botão Importar no celular**, sem e-mail nem documento.
- **Cadastro mobile (`M-Inquilino-cadastrar`):** mesmo formulário do desktop em tela cheia; o Tipo é um controle segmentado (Pessoa física | Empresa), não chips. O mobile omite Observações; seguimos o desktop (Observações presente, Fiador adiado).
- **Detalhe mobile (`M-Inquilino-detalhe`):** nome e selo, Cobrança do mês, Contato, Contrato atual e "Extrato de pagamentos / Ver extrato" e o botão fixo "Confirmar pagamento". Os dois últimos ficam adiados (Extrato e fluxo 04). Sem documento nem observações no mobile; seguimos o desktop responsivo.
- **Selo de cobrança:** ponto colorido + rótulo. Cores do canvas: Aguardando (warning, adiado), Atrasado (destructive), Pago (success), Previsto (cinza). O estado "Aguardando confirmação" que aparece nas artboards não existe nesta onda.
- **`LATE` no backend (1.2):** `GET /payments` filtra em SQL com a data de hoje (`s.today()`) e enriquece cada cobrança (`enrich`: vencida e não paga vira `LATE`, com multa e juros). Então `status=LATE` já considera pagamentos vencidos, e `from`/`to` filtram o vencimento, inclusive. Sem pendência.
- **Usos (1.3):** `TenantListClient` só é usado em `app/tenants/page.tsx`; o tipo `TenantFormData` também. O `[id]/page.tsx` não depende de nenhum dos dois. Sem outros consumidores.

## Open Questions

- O botão "Criar contrato" deveria abrir o painel de contrato já com o inquilino escolhido; hoje não há esse destino. Fica em `/leases` até a onda de Contratos.
