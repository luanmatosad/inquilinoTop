## Context

O MCP do ClickUp já está conectado nesta sessão (`clickup_*` tools disponíveis). Workspace confirmada pelo usuário: `90171083762`, Space `90174982017` ("Space"). **Correção**: a exploração inicial (modo explore, antes da implementação) checou só superficialmente (`max_depth=0`) e concluiu erroneamente que a workspace estava vazia. Na prática já existe estrutura rica dentro do Space: Folder "ImoviFlow" (`90178524392`) com listas de roadmap de produto por fase (Fase 1/2/3) e por etapa de UI (`🎨 UI 0 — Fundação e Design System`, `UI 1-4`), além de folders pessoais ("🧠 Pessoal & Desenvolvimento", "✍️ Conteúdo & Estudos"). Decisão do usuário: manter "ImoviFlow" intacto (é roadmap de produto, granularidade diferente de openspec change) e criar um Folder novo "Changes" como irmão, dedicado a tracking técnico das openspec changes — sem misturar com planejamento de fase/UI.

O fluxo de trabalho técnico atual usa `openspec/changes/<name>/tasks.md` com checkboxes `- [ ] N.M descrição`, aplicado via skill `openspec-apply-change`. Esse formato é a fonte de verdade técnica e não deve ser substituído.

## Goals / Non-Goals

**Goals:**
- Visibilidade de produto/prazo no ClickUp sem duplicar o trabalho de manter a checklist técnica
- Estrutura ClickUp simples o suficiente para não precisar de automação externa (webhooks/cron) — sincronização feita pelos próprios skills do openspec durante o fluxo normal de trabalho
- Direção de verdade clara: tasks.md → ClickUp (nunca o contrário, pra não haver conflito de merge)

**Non-Goals:**
- Não implementa webhook/listener em tempo real do ClickUp pro repo (exigiria infraestrutura nova — fora de escopo)
- Não migra changes já arquivadas pro ClickUp retroativamente
- Não usa ClickUp pra armazenar a spec técnica (specs/design ficam só no openspec)

## Decisions

**1. Granularidade: List por change, Task por grupo, Subtask por checkbox**
Alternativa considerada: 1 Task do ClickUp por checkbox (sem agrupamento). Rejeitada — perderia a visão de "grupo lógico" que `## 1. Setup`, `## 2. Core` etc já expressam em tasks.md; replicar a mesma hierarquia é mais fiel e mais fácil de ler no ClickUp.

**2. Direção única de sync: openspec → ClickUp**
openspec é editado por quem trabalha o código (eu + usuário via Claude Code). ClickUp pode ser editado por outras pessoas (prazo, comentário, responsável) sem risco de sobrescrever a checklist técnica, porque a sincronização nunca lê status de volta do ClickUp pra decidir o que está feito no código.

**3. Sincronização "on-the-fly" nos skills, não um job separado**
Como o ClickUp MCP já está disponível nas mesmas sessões que executam `/opsx:apply`, a sincronização acontece como passo extra dentro do skill (criar/atualizar subtask ao marcar checkbox) em vez de um processo assíncrono separado — evita construir e manter infraestrutura de automação.

**4. Workspace e Space existentes reutilizados, só o Folder "Changes" é novo**
Workspace `90171083762` / Space `90174982017` confirmados pelo usuário. Não criar Space novo "InquilinoTop" (como o design original presumia) — o Space existente já é usado pra outras coisas do usuário (ImoviFlow + pessoal), renomeá-lo seria presunçoso e fora do que foi pedido. Só o Folder "Changes" é estrutura nova.

## Risks / Trade-offs

- [ClickUp e tasks.md saem de sincronia se alguém editar tasks.md fora do fluxo do skill (ex: edit manual)] → Skill de apply sempre relê `tasks.md` antes de sincronizar; se o usuário editar manualmente, próxima execução do skill corrige a divergência (sync é idempotente, não incremental-only).
- [Criar List/Task pra toda change pequena gera ruído no ClickUp] → Critério: só changes com `tasks.md` (todo o schema `spec-driven` tem) ganham List; changes triviais continuam só no openspec se o usuário preferir pular o sync numa instância específica.
- [Workspace errada escolhida inicialmente] → Fácil de mover depois (ClickUp permite mover Space entre workspace via API/UI); não é decisão irreversível.

## Migration Plan

1. Perguntar ao usuário qual workspace ClickUp usar (452099 ou 90171083762)
2. Criar Space "InquilinoTop" + Folder "Changes" na workspace escolhida
3. Criar List para as 3 changes já propostas nesta sessão (migrate-shadcn-ui-kit, add-decision-log, sync-clickup-openspec) como piloto
4. Atualizar os 3 skills (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`) com os passos de sync
5. Validar o fluxo completo numa change piloto antes de considerar concluído
6. Rollback: é só parar de chamar as ferramentas ClickUp nos skills — não há dependência de dados entre openspec e ClickUp, nada precisa ser desfeito

## Open Questions

- Convenção de nome de List: nome exato do openspec change (kebab-case) ou título mais legível? (default: usar o nome do change, consistente e sem ambiguidade)
