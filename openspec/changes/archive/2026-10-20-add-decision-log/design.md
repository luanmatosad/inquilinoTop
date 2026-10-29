## Context

O projeto documenta arquitetura via `CLAUDE.md` por módulo (o quê/como o módulo funciona hoje) e `openspec/changes/*/design.md` (porquê de uma change específica, durante sua execução). Quando a change é arquivada, o `design.md` vai para `openspec/changes/archive/` — ainda existe, mas não é descoberto naturalmente por quem está lendo o `CLAUDE.md` do módulo meses depois. Não há hoje um lugar único, estável, para "por que decidimos X" por domínio.

## Goals / Non-Goals

**Goals:**
- Um ADR log por domínio, versionado em PR, que sobrevive ao ciclo de vida das openspec changes
- Backfill das decisões arquiteturais já tomadas e identificáveis hoje
- Processo simples e leve para novas decisões (não burocratizar)

**Non-Goals:**
- Não substitui `design.md` das changes — ADR é o resumo duradouro, `design.md` continua sendo o detalhamento da change em si
- Não cobre decisões de produto/UX (isso é escopo de proposal.md/discussão com usuário, não ADR técnico)
- Não tenta documentar retroativamente TODA decisão já tomada — só as que têm impacto arquitetural relevante e são citáveis (identificadas nos `CLAUDE.md` e regras atuais)

## Decisions

**1. Um ADR por arquivo, agrupado por domínio (`docs/decisions/<domínio>/NNNN-titulo.md`)**
Alternativa considerada: um único `DECISIONS.md` global. Rejeitada — cresceria sem controle e dificultaria navegação; agrupar por domínio espelha a estrutura já existente em `backend/internal/<domínio>/` e nos módulos de `CLAUDE.md`.

**2. Numeração sequencial por domínio, não global**
`identity/0001-...`, `rbac/0001-...` — cada domínio tem sua própria sequência. Evita coordenação de um contador global entre PRs paralelos em domínios diferentes.

**3. Status explícito em cada ADR (Proposed/Accepted/Superseded/Deprecated)**
Decisões mudam. Em vez de editar o ADR antigo silenciosamente, uma decisão nova que substitui uma antiga cria um novo ADR e marca o antigo como `Superseded`, linkando pro novo. Preserva histórico.

**4. Índice central (`docs/decisions/README.md`) + link no `CLAUDE.md` do módulo**
Duas portas de entrada: quem navega a documentação do módulo vê os ADRs relevantes linkados; quem quer visão geral de todas as decisões do projeto usa o índice.

**5. Backfill limitado ao que já está documentado ou é claramente inferível do código**
Não é um exercício de arqueologia de git log completo — backfill cobre as decisões já citadas em `CLAUDE.md`/regras atuais (JWT RS256, soft-delete, SINGLE auto-unit, hierarquia RBAC, imutabilidade de Payment/audit, etc.), não uma varredura exaustiva de todo commit histórico.

## Risks / Trade-offs

- [ADR log se torna burocracia e cai em desuso] → Processo deliberadamente leve: 4 seções fixas (Status/Context/Decision/Consequences), sem aprovação formal obrigatória, criado no mesmo PR da decisão.
- [Backfill fica incompleto/desatualizado em relação ao código real] → Backfill explicitamente escopado ao que está em `CLAUDE.md`/regras hoje; decisões não documentadas em nenhum lugar ficam de fora deste backfill (podem ser adicionadas depois, não bloqueia esta change).
- [Duplicação entre ADR e `design.md` de change] → ADR é o resumo estável pós-decisão; `design.md` pode referenciar o ADR por id em vez de duplicar texto, reduzindo a chance de diverger.

## Migration Plan

1. Criar estrutura de diretórios + template + índice vazio
2. Escrever os ADRs de backfill, um domínio por vez
3. Linkar ADRs nos `CLAUDE.md` dos módulos correspondentes
4. Atualizar índice `docs/decisions/README.md`
5. Sem rollback necessário — é aditivo, não toca código de produção

## Open Questions

- Nenhuma pendente — escopo e processo já validados com o usuário nesta sessão.
