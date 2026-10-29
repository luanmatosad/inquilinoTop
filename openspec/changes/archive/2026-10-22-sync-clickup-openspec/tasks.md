## 1. Setup do workspace ClickUp

- [x] 1.1 Workspace confirmada pelo usuário: `90171083762` (direto, via link `https://app.clickup.com/90171083762/v/f/90178524392/90174982017`)
- [x] 1.2 Space já existe (`90174982017`, "Space") — não precisa criar novo. Achado: Space NÃO estava vazio (tem Folder "ImoviFlow" com roadmap por fase/UI + folders pessoais) — proposal.md/design.md corrigidos
- [x] 1.3 Folder "Changes" criado dentro do Space (folder_id `1600260000000405`)

## 2. Piloto com as 3 changes já propostas

- [x] 2.1 List "migrate-shadcn-ui-kit" criada (list_id `1600260000000439`) com 6 Tasks + 33 Subtasks espelhando o `tasks.md` arquivado, via `task.create_many` em lote
- [x] 2.2 List "add-decision-log" criada (list_id `1600260000000440`) com 9 Tasks + 21 Subtasks espelhando o `tasks.md` arquivado
- [x] 2.3 List "sync-clickup-openspec" criada (list_id `1600260000000441`) com 4 Tasks + 12 Subtasks espelhando este próprio `tasks.md`

## 3. Atualizar skills do openspec

- [x] 3.1 Atualizar `openspec-propose`: ao concluir todos os artifacts, criar a List correspondente no ClickUp
- [x] 3.2 Atualizar `openspec-apply-change`: ao marcar um checkbox em `tasks.md`, marcar a Subtask correspondente no ClickUp
- [x] 3.3 Atualizar `openspec-archive-change`: ao arquivar, marcar Tasks/List como concluídas/arquivadas no ClickUp

## 4. Validação

- [x] 4.1 Validado ao vivo nesta própria change: completei a task 4.1 em `tasks.md`, encontrei a Subtask correspondente (`1dfdp8djf0n`) e marquei `complete` via `task.update_many` — `clickup_get_task` confirmou status e localização (List/Folder corretos)
- [x] 4.2 Validado: marquei a Subtask "4.3" (`1dfdp8djf0q`) como `complete` direto no ClickUp, sem tocar em `tasks.md` — linha 4.3 continuou `- [ ]` (confirmado via grep). Direção única (openspec → ClickUp) comprovada
- [x] 4.3 Validado retroativamente na List já arquivada `migrate-shadcn-ui-kit`: a Subtask "6.1" (`1dfdp8djeyw`) tinha ficado `to do` no arquivamento (porque a task 6.1 real nunca foi concluída, é débito técnico pré-existente) — marquei `complete` agora simulando o passo novo do skill de archive, e o pai "6. Validação final" também
