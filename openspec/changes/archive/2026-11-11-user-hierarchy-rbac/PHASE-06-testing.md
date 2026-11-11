# Fase 6: Testing & Validation

## Status: ⏳ Pendente

### Tasks

- [ ] 14.1 Tests para `rbac/service.go` — matriz de permissões com herança
  - `owner` tem todas as permissões
  - `admin` herda de `manager`, `employee`, `viewer`
  - `manager` herda de `employee`, `viewer`
  - `employee` herda de `viewer`
  - `viewer` só tem permissões de leitura
  - `CheckPermission` retorna true para role com permissão + herança
  - `CheckPermission` retorna false para role sem permissão

- [ ] 14.2 Integration tests para Organization CRUD
  - Criar organização
  - Listar membros
  - Criar filial
  - Atualizar/remove membro

- [ ] 14.3 Integration tests para Invite flow
  - Criar convite
  - Aceitar convite (usuário existente + novo)
  - Convite expirado retorna erro
  - Convite já aceito retorna erro
  - Cancelar convite

- [ ] 14.4 Verificar todos os testes existentes
  - `make test-backend` passa
  - `make test-backend-integration` passa

- [ ] 14.5 Test manual do RBAC middleware
  - Viewer tenta criar propriedade → 403
  - Employee tenta deletar propriedade → 403
  - Admin cria propriedade → 201
  - Owner acessa tudo → 200
  - Branch-scoped member acessa só branch → 200/403 conforme escopo

### Dependências
- ⛔ Requer que **Fase 4** (Domain Migration) esteja completa
- ⛔ Requer que todas as fases anteriores estejam funcionais

### Test Commands
```bash
make test-backend              # unit tests
make test-backend-integration  # integration (requer Docker)
```