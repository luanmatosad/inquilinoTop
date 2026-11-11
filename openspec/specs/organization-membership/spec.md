# organization-membership Specification

## Purpose
TBD - created by archiving change harden-org-access-controls. Update Purpose after archive.

## Requirements

### Requirement: Usuário é owner de no máximo uma organização
O sistema SHALL garantir que um usuário seja owner de no máximo uma organização, inclusive sob requisições concorrentes.

#### Scenario: Criação concorrente de organização
- **WHEN** duas requisições `POST /api/v1/organizations` do mesmo usuário chegam simultaneamente
- **THEN** exatamente uma responde 201 e a outra responde 409 com código `ALREADY_HAS_ORG`
- **AND** existe apenas uma organização cujo owner é esse usuário

#### Scenario: Criação quando o usuário já tem organização
- **WHEN** o usuário já é membro de uma organização e envia `POST /api/v1/organizations`
- **THEN** a resposta é 409 com código `ALREADY_HAS_ORG`
- **AND** nenhuma organização nova é criada

#### Scenario: Falha na criação não deixa organização órfã
- **WHEN** a inserção do owner falha dentro da criação de organização
- **THEN** a organização não é persistida
