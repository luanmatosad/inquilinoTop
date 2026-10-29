## Why

Hoje o progresso de trabalho vive só em `openspec/changes/*/tasks.md` — ótimo pra spec técnica, mas sem visibilidade de prazo, responsável ou visão de produto. O usuário já tem o MCP do ClickUp conectado e quer que ele e a IA trabalhem as atividades sempre com base no ClickUp, sem abandonar o rigor técnico do openspec. Workspace confirmada pelo usuário: `90171083762`, Space `90174982017`. O Space já tem estrutura própria (Folder "ImoviFlow" com roadmap por fase/UI, folders pessoais) — a sincronização entra como um Folder novo "Changes", irmão dos existentes, sem tocar no que já está lá.

## What Changes

- Criar, no Space existente (`90174982017`, workspace `90171083762`), um Folder novo "Changes" → 1 List por openspec change ativa
- Mapear granularidade: cada grupo numerado de `tasks.md` (ex: "## 1. Setup") vira uma Task no ClickUp; cada checkbox vira uma Subtask
- Definir openspec como fonte de verdade da checklist técnica (`tasks.md`) e ClickUp como camada de prazo/responsável/visão de produto — nunca o contrário
- Ao finalizar `/opsx:propose` (change com todos os artifacts prontos), criar a List correspondente no ClickUp
- Ao marcar um checkbox em `tasks.md` durante `/opsx:apply`, refletir o mesmo status na Subtask correspondente no ClickUp
- Ao arquivar uma change (`/opsx:archive`), mover ou marcar a List do ClickUp como concluída/arquivada
- Atualizar os skills `openspec-propose`, `openspec-apply-change` e `openspec-archive-change` com as instruções de sincronização acima

## Capabilities

### New Capabilities
- `clickup-openspec-sync`: Estrutura e processo de sincronização entre o workspace ClickUp do projeto e as changes/tasks do openspec.

### Modified Capabilities
- Nenhuma — não há specs existentes em `openspec/specs/` para este domínio ainda.

## Impact

- ClickUp: novo Folder "Changes" + Lists dentro do Space existente (ação única de setup, via MCP)
- `.claude/skills/openspec-propose/SKILL.md` (ou equivalente): passo adicional de criar a List no ClickUp ao concluir os artifacts
- `.claude/skills/openspec-apply-change/SKILL.md`: passo adicional de sincronizar status de subtask ao marcar checkbox
- `.claude/skills/openspec-archive-change/SKILL.md`: passo adicional de arquivar/concluir a List correspondente
- Nenhum impacto em código de produção (Go/Next.js)
