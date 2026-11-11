# organization-invites Specification

## Purpose
Define como uma organização convida pessoas, como o token de convite é tratado e como o convidado aceita. Protege a concessão de acesso contra papel elevado, e-mail trocado, reuso e corrida.

## Requirements

### Requirement: Convite não concede papel owner

O sistema MUST rejeitar a criação de convite com `role=owner`.

#### Scenario: owner como papel de convite
- **WHEN** um membro com `member:invite` cria convite com `role` igual a `owner`
- **THEN** a resposta é 400 com código `INVALID_ROLE` e nenhum convite é gravado

#### Scenario: papel permitido
- **WHEN** o convite é criado com `role` em `admin`, `manager`, `employee` ou `viewer`
- **THEN** o convite é gravado com o papel informado

### Requirement: Token de convite não fica em texto puro

O sistema MUST armazenar apenas o hash SHA-256 do token de convite. O token bruto MUST ser devolvido uma única vez, na resposta de criação.

#### Scenario: criação devolve token bruto
- **WHEN** um convite é criado com sucesso
- **THEN** a resposta 201 inclui o token bruto e o banco guarda apenas o hash

#### Scenario: listagem não expõe token
- **WHEN** a organização lista convites
- **THEN** nenhum campo de token aparece na resposta

#### Scenario: convite pendente antes da migration continua válido
- **WHEN** a migration converte tokens pendentes para hash e o link já enviado é usado
- **THEN** o aceite funciona com o mesmo token bruto

### Requirement: Aceite exige o e-mail do convite

O sistema MUST aceitar o convite somente quando o e-mail do usuário autenticado for igual ao e-mail do convite, sem diferenciar maiúsculas de minúsculas.

#### Scenario: e-mail confere
- **WHEN** o usuário autenticado com e-mail igual ao do convite envia o token
- **THEN** o aceite é concluído

#### Scenario: e-mail diverge
- **WHEN** outro usuário autenticado envia um token válido de convite destinado a outro e-mail
- **THEN** a resposta é 404 com código `INVITE_NOT_FOUND` e o convite continua pendente

### Requirement: Aceite é de uso único e atômico

O sistema MUST criar a membership e marcar o convite como aceito na mesma transação, com marcação condicional (`accepted_at IS NULL`). Um convite aceito MUST NOT ser aceito de novo.

#### Scenario: aceite concorrente
- **WHEN** dois aceites do mesmo convite chegam ao mesmo tempo
- **THEN** exatamente um cria a membership, e o outro responde 409 com código `INVITE_ALREADY_USED`

#### Scenario: falha no meio do aceite
- **WHEN** a criação da membership falha
- **THEN** o convite continua pendente e nenhuma membership parcial fica gravada

#### Scenario: convite já usado
- **WHEN** um convite já aceito é enviado de novo
- **THEN** a resposta é 409 com código `INVITE_ALREADY_USED`

### Requirement: Aceite recusa convite expirado ou inválido

O sistema MUST responder com código específico para convite inexistente, expirado ou já usado, e MUST responder 500 para falha de banco.

#### Scenario: convite expirado
- **WHEN** o token é de convite com `expires_at` no passado
- **THEN** a resposta é 400 com código `INVITE_EXPIRED`

#### Scenario: token inexistente
- **WHEN** nenhum convite corresponde ao hash do token
- **THEN** a resposta é 404 com código `INVITE_NOT_FOUND`

#### Scenario: falha de banco
- **WHEN** a consulta do convite falha por erro de infraestrutura
- **THEN** a resposta é 500 e não 400

### Requirement: Usuário com organização não aceita outro convite

O sistema MUST recusar o aceite quando o usuário já tem membership em outra organização.

#### Scenario: usuário já em outra org
- **WHEN** o usuário já é membro de outra organização e aceita convite de uma terceira
- **THEN** a resposta é 409 com código `ALREADY_HAS_ORG` e nenhuma membership nova é criada

### Requirement: Token renovado após aceite

Após aceitar, o cliente MUST obter JWT com a organização chamando `POST /api/v1/auth/refresh`. O sistema NÃO cria endpoint novo para isso.

#### Scenario: refresh após aceite
- **WHEN** o aceite conclui e o cliente chama refresh
- **THEN** o novo access token contém a organização e o papel do convite
