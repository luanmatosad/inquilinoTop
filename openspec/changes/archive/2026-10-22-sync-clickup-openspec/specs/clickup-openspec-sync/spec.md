## ADDED Requirements

### Requirement: Estrutura ClickUp espelha changes do openspec
O sistema SHALL manter, no workspace ClickUp designado, um Space "InquilinoTop" com um Folder "Changes" contendo uma List por openspec change ativa (schema `spec-driven` com `tasks.md`).

#### Scenario: Nova change com artifacts completos
- **WHEN** uma openspec change termina `/opsx:propose` com todos os artifacts (`proposal`, `design`, `specs`, `tasks`) completos
- **THEN** uma List nova é criada no Folder "Changes" do ClickUp com o mesmo nome (kebab-case) da change

### Requirement: Grupos e checkboxes de tasks.md espelham Task/Subtask no ClickUp
O sistema SHALL criar uma ClickUp Task para cada grupo numerado de `tasks.md` (ex: "## 1. Setup") e uma Subtask para cada checkbox dentro do grupo.

#### Scenario: Tasks.md tem 3 grupos com checkboxes
- **WHEN** uma change tem `tasks.md` com grupos "## 1. Setup", "## 2. Core", "## 3. Validação"
- **THEN** a List correspondente no ClickUp tem 3 Tasks, cada uma com Subtasks correspondentes aos checkboxes daquele grupo

### Requirement: Sincronização unidirecional openspec → ClickUp
O sistema SHALL propagar o status de um checkbox marcado como concluído em `tasks.md` para a Subtask correspondente no ClickUp, e SHALL NUNCA inferir conclusão de uma tarefa a partir do status de uma Subtask no ClickUp.

#### Scenario: Checkbox marcado durante /opsx:apply
- **WHEN** um checkbox de `tasks.md` é marcado `- [x]` durante a execução de `/opsx:apply`
- **THEN** a Subtask correspondente no ClickUp é marcada como concluída na mesma operação

#### Scenario: Subtask marcada manualmente no ClickUp
- **WHEN** alguém marca uma Subtask como concluída diretamente no ClickUp, sem o checkbox correspondente estar marcado em `tasks.md`
- **THEN** isso não altera o estado de `tasks.md` nem é interpretado como a task estar de fato concluída — próxima execução do skill de apply corrige a divergência (recria o estado a partir de `tasks.md`)

### Requirement: Arquivamento reflete no ClickUp
O sistema SHALL marcar a List do ClickUp correspondente como concluída/arquivada quando a openspec change é arquivada via `/opsx:archive`.

#### Scenario: Change arquivada
- **WHEN** uma change passa por `/opsx:archive`
- **THEN** todas as Tasks da List correspondente no ClickUp são marcadas como concluídas e a List é marcada/movida como arquivada
