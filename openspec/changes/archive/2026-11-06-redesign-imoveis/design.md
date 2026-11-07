## Context

Telas do canvas: `Imoveis-vazia`, `Imoveis-lista`, `Imoveis-cadastrar` (painel lateral), `Imoveis-detalhe` (abas), `Unidades-cadastrar`, `M-Imoveis`, `M-Imovel-cadastrar`. Estado atual, verificado no repo:

- **Backend `property`:** `Property` tem `type`, `name`, `address_line`, `neighborhood`, `city`, `state`, `postal_code`. `Unit` já tem `label`, `floor`, `area_m2`, `bedrooms`, `bathrooms`, `notes`. O tipo só é validado em `service.go` (`RESIDENTIAL`/`SINGLE`, e `SINGLE` cria "Unidade 01") e em `model.go` (`oneof`). A migration `000003` limita `type` a esses dois valores. A última migration é a `000045`.
- **`/leases` e `/tenants`:** sem paginação, devolvem todos os registros ativos da organização. `Lease` tem `unit_id`, `tenant_id`, `status` (`ACTIVE`, `ENDED`, `CANCELED`) e `start_date`.
- **Frontend:** `app/properties/page.tsx` (grade de cards, filtros/ordenação que são botões sem ação), `/properties/new` e `/properties/[id]/edit` como páginas, `[id]/page.tsx` com card "Unidades". Formulários em `components/properties/` (`PropertyForm`, `UnitForm`, `UnitList`) com react-hook-form + Zod e Server Actions em `actions.ts`.
- **`TopBar`** ainda tem o botão "Novo imóvel", que o canvas não desenha.

## Goals / Non-Goals

**Goals:**
- Telas de Imóveis fiéis ao canvas no desktop e no celular.
- `COMMERCIAL`, `number` e `complement` suportados de ponta a ponta.
- Ocupação (alugada/vaga/inquilino/desde) e KPIs corretos, derivados dos dados existentes.

**Non-Goals:**
- Preenchimento do endereço pelo CEP (depende de serviço externo; decisão adiada).
- Abas Despesas e Recebimento (Pix) do detalhe.
- Importar, Inquilinos, Contratos.
- Paginação das listas (ver Riscos).

## Decisions

**1. `COMMERCIAL` como tipo multiunidade, no backend.**
Migration `000046` troca o `CHECK` de `properties.type` para aceitar `COMMERCIAL`. O serviço aceita os três tipos e só `SINGLE` cria unidade automática. A constraint se chama `properties_type_check`; a migration a recria com os três valores. A migration `down` volta ao `CHECK` antigo e, se existirem linhas `COMMERCIAL`, **falha de propósito** em vez de apagá-las ou convertê-las em silêncio. Alternativas descartadas: tratar Comercial como `RESIDENTIAL` (esconde o dado e quebra Relatórios/Carnê-leão depois) e retirar Comercial do canvas (o produto lista pontos comerciais).

**2. Número e complemento em colunas próprias.**
`number VARCHAR(20)` e `complement VARCHAR(100)`, opcionais, sem backfill. A exibição compõe `address_line, number` e acrescenta o complemento. Alternativa descartada: concatenar em `address_line`, que obriga a quebrar o texto na edição e perde dado.

**3. Ocupação derivada no servidor Next, em uma função pura.**
`src/lib/property-occupancy.ts` recebe imóveis (com unidades), contratos e inquilinos e devolve, por unidade, `{ status: 'RENTED' | 'VACANT', tenant?: { id, name }, since?: date }`, mais totais por imóvel e KPIs. Regras: só conta contrato com `status === 'ACTIVE'`; se a mesma unidade tiver mais de um, vale o de `start_date` mais recente; contrato com `tenant_id` sem inquilino correspondente mostra a unidade como alugada sem nome. A lista só precisa de imóveis e contratos (2 buscas em paralelo, `Promise.allSettled`); o detalhe acrescenta inquilinos para mostrar o nome. Alternativa descartada: o backend devolver `status` e `tenant` em cada unidade. É mais correto, mas é uma feature a mais, e a função pura migra para o Go quando o volume pedir.

**3a. Degradação.** Imóveis é obrigatório: se falhar, mostra o estado de erro com nova tentativa. Contratos e inquilinos são opcionais: se falharem (por permissão ou erro), a lista aparece com Ocupação "—", os KPIs Alugadas e Vagas somem e um aviso discreto informa que a ocupação está indisponível.

**4. Painel lateral controlado pela URL.**
`/properties?novo=1` abre o painel de cadastro de imóvel; no detalhe, `?unidade=nova` ou `?unidade=<id>` abre o de unidade. O estado na URL permite link direto e o botão voltar fecha o painel. Usa `Sheet` (já em `ui/`), renderizando o formulário existente. `/properties/new` redireciona para `/properties?novo=1` e `/properties/[id]/edit` para `/properties/[id]?aba=informacoes`. Alternativa descartada: estado local no cliente, que perde link direto e histórico.

**5. Formulários reaproveitados.**
`PropertyForm` e `UnitForm` mantêm react-hook-form, Zod e Server Actions; muda o layout (campos do canvas) e os campos novos. `schemas.ts` ganha `COMMERCIAL`, `number` e `complement`. A edição de imóvel vive na aba Informações, sem painel.

**6. Lista e detalhe com `Table` e `Tabs` de `ui/`.**
Busca por `?q=` (já existe) e filtro por tipo em `?tipo=`. Detalhe com `?aba=unidades|informacoes`. Só duas abas: itens Despesas e Recebimento ficam fora até existirem dados (sem aba desabilitada, que prometeria algo). Ordenação fica de fora.

**7. Mobile na mesma página.**
Abaixo de `md`, a tabela vira lista de cards e o painel ocupa a tela toda. Sem componentes paralelos para desktop e celular. Os detalhes sairão de `M-Imoveis` e `M-Imovel-cadastrar`.

**8. `TopBar` sem "Novo imóvel".**
O botão passa para o cabeçalho da página de Imóveis ("Cadastrar imóvel"). O teste do `TopBar` é atualizado.

## Risks / Trade-offs

- [Listas de contratos e inquilinos sem paginação: a junção carrega tudo] → Aceitável para o porte atual; a função pura isola a regra. Se passar de alguns milhares de contratos, mover a ocupação para o backend. Registrado como dívida.
- [Imóvel em tabela de uma tela com muitas unidades fica longo] → Sem paginação nesta onda; o canvas também não a desenha.
- [`CHECK` do tipo] → A migration recria `properties_type_check`; o teste de integração cobre criar `COMMERCIAL`, e o `down` foi verificado com e sem imóveis `COMMERCIAL`.
- [Quem acessa `/properties/new` ou `/edit` por favoritos] → Redirecionamentos preservam o fluxo.
- [Usuário sem permissão de leitura de contratos/inquilinos] → Degradação 3a em vez de erro total.
- [Preset `shadcnds` (radix-nova) × frontend (new-york)] → Conferir visualmente no navegador após copiar `table`/`tabs`, conforme `design-system.md`.

## Migration Plan

1. Migration `000046` (sobe junto com o deploy do backend; compatível com linhas atuais).
2. Backend com `COMMERCIAL`, `number`, `complement`.
3. Frontend. Rollback do frontend não exige rollback do banco; rollback da migration só é possível sem imóveis `COMMERCIAL`.

## Decisões da leitura do canvas (tarefa 1.1)

- **Painel de unidade (`Unidades-cadastrar`):** Nome da unidade, Andar (opcional), Área (m²), Quartos, Banheiros, Observações e a nota "O endereço é o do imóvel". Mapeia para `label`, `floor`, `area_m2`, `bedrooms`, `bathrooms`, `notes`.
- **"Aluguel de referência" fica fora.** O canvas pede um campo que o backend não tem e que só serve de sugestão ao criar contrato. Sem Contratos consumindo, seria dado gravado e nunca usado. Entra na onda de Contratos, com migration própria.
- **Mobile é o mesmo formulário do desktop.** `M-Imovel-cadastrar` mostra uma versão reduzida e traz um 4º tipo, "Terreno", e o interruptor "Tem várias unidades". Seguimos o desktop como fonte dos campos: `Terreno` não existe no domínio e o interruptor repete a escolha Casa × Residencial/Comercial. No celular o painel ocupa a tela toda com o rodapé fixo "Cadastrar imóvel". Se o produto quiser Terreno, é uma decisão à parte (novo tipo e ADR).
- **Estado vazio (`Imoveis-vazia`):** a busca, "Filtros" e "Cadastrar imóvel" continuam visíveis; abaixo, um bloco `muted` com ícone, "Cadastre seu primeiro imóvel" e "É o primeiro passo para cobrar aluguel. Leva cerca de 1 minuto.", mais um botão "Cadastrar imóvel".
- **Lista mobile (`M-Imoveis`):** linha-resumo "5 imóveis · 14 unidades · 5 alugadas" no lugar dos 4 indicadores, cards com nome, "logradouro, número · bairro", selo do tipo e "N de M alugadas", e botão fixo "Cadastrar imóvel" acima da barra inferior.
- **Detalhe:** não existe artboard mobile do detalhe do imóvel. O detalhe reaproveita o desktop responsivo (tabela de unidades vira cards abaixo de `md`). O cabeçalho do detalhe tem o breadcrumb "Imóveis › Detalhes".

## Open Questions

- O produto quer o tipo "Terreno"? Hoje fica de fora (ver acima).
- Em qual onda entra "Aluguel de referência" da unidade? Proposta: Contratos.
