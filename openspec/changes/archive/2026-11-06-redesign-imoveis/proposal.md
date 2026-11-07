## Why

Imóveis é a raiz da hierarquia de entidades (Property → Unit → Lease) e a primeira tela da Onda 1 do redesign, que usa o canvas "ImoviFlow — Telas" como fonte da verdade. As telas atuais (grade de cards, página cheia de cadastro, detalhe em uma só página) divergem do canvas, e o canvas pede três coisas que o backend ainda não tem: tipo Comercial, número e complemento no endereço, e a visão de ocupação (alugada/vaga).

## What Changes

**Backend (`property`)**
- Novo tipo `COMMERCIAL`: multiunidade como `RESIDENTIAL` (não cria unidade automática). Migration amplia o `CHECK` de `properties.type`.
- Novas colunas opcionais `number` e `complement` em `properties`, com validação de tamanho, expostas na API.
- `.claude/rules/domain-model.md`, ADR `property-0002` e Swagger atualizados.

**Frontend (`/properties`)**
- Lista em tabela (Imóvel, Tipo, Unidades, Ocupação) com 4 KPIs (Imóveis, Unidades, Alugadas, Vagas), busca por nome e filtro por tipo funcionais, estado vazio e estado de erro com nova tentativa.
- Cadastro e edição de imóvel e de unidade em painel lateral (`Sheet`). `/properties/new` redireciona para a lista com o painel aberto.
- Detalhe com abas **Unidades** (andar, área, quartos, banheiros, situação, inquilino e "desde") e **Informações** (edição). As abas Despesas e Recebimento ficam fora até existirem os dados.
- Ocupação derivada no servidor Next por junção de `/properties`, `/leases` e `/tenants` (sem mudança de backend para isso).
- Versão mobile das telas (lista em cards, cadastro em tela cheia).
- Remover "Novo imóvel" do `TopBar`: o botão passa a viver na página.
- **BREAKING** (rota): `/properties/new` deixa de ser uma página e vira redirecionamento.

**Fora de escopo:** preenchimento automático de endereço pelo CEP (fica a máscara atual), aba Recebimento (Pix) e aba Despesas, Importar (fluxo 12), qualquer mudança em Inquilinos e Contratos.

## Capabilities

### New Capabilities
- `property-occupancy`: derivação de situação (alugada/vaga), inquilino atual e KPIs de ocupação a partir de unidades, contratos ativos e inquilinos.

### Modified Capabilities
- `property-registry`: tipo `COMMERCIAL`, campos `number` e `complement`, telas em painel lateral, lista em tabela com KPIs e detalhe em abas.

## Impact

- Backend: `backend/internal/property/{model,service,repository,handler}.go` e testes, nova migration `000046`, `backend/docs/` (Swagger via `swag init`), `docs/decisions/property/0002-*.md` e o índice do README das decisões.
- Frontend: `src/app/properties/**`, `src/components/properties/**`, `src/types/index.ts`, `src/lib/schemas.ts`, `src/components/TopBar.tsx`, testes correspondentes.
- Dados: coluna nova em tabela existente, sem backfill (campos opcionais). O `CHECK` ampliado é compatível com linhas atuais.
- Dependências: nenhuma nova. Componentes novos de `ui/*` (`table`, `sheet`, `tabs` já existem) devem vir do `shadcnds`.
