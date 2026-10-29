## ADDED Requirements

### Requirement: shadcn/ui como única biblioteca de componentes
O frontend SHALL usar shadcn/ui (componentes em `src/components/ui/`) como única biblioteca de componentes de interface, sem dependência de HeroUI.

#### Scenario: Dependências limpas
- **WHEN** se inspecionam `frontend/package.json` e `package-lock.json`
- **THEN** não existe nenhum pacote `@heroui/*`

#### Scenario: Código limpo
- **WHEN** se busca `heroui` (sem diferenciar maiúsculas) em `frontend/src` e na configuração do frontend
- **THEN** não há ocorrências

#### Scenario: Reintrodução bloqueada
- **WHEN** um arquivo importa de `@heroui/*`
- **THEN** o lint (`make frontend-lint`) falha

### Requirement: Documentação sem referência ativa a HeroUI
Os artefatos vivos do projeto (specs ativos, changes abertas, regras em `.claude/rules/` e docs de frontend) SHALL não instruir o uso de HeroUI.

#### Scenario: Change obsoleta
- **WHEN** a change `migrate-frontend-to-heroui` é revisada
- **THEN** está arquivada como descartada e não aparece em `openspec list`

#### Scenario: Docs de design
- **WHEN** um `DESIGN.md` ou handoff cita a biblioteca de componentes
- **THEN** cita shadcn/ui

### Requirement: Novas telas usam componentes shadcn
Toda tela nova SHALL ser composta por componentes de `src/components/ui/`, adicionando via CLI do shadcn quando faltar.

#### Scenario: Componente ausente
- **WHEN** uma tela precisa de componente inexistente (ex.: tabs, accordion)
- **THEN** ele é adicionado com `shadcn add` em `src/components/ui/` e não é escrito do zero nem importado de outra biblioteca

#### Scenario: Registro da decisão
- **WHEN** a change é concluída
- **THEN** existe um ADR em `docs/decisions/_cross-cutting/` registrando shadcn/ui como padrão
