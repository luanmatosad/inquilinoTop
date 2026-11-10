## ADDED Requirements

### Requirement: Lembretes e modelos de mensagem
O sistema SHALL guardar por organização uma lista de 1 a 8 lembretes (nome de 1 a 40 caracteres, dias de -30 a 60 em relação ao vencimento, únicos, e texto de 1 a 1000 caracteres), expondo `GET /settings/reminders` (`org:read`) e `PUT /settings/reminders` (`org:update`, substitui a lista inteira). Sem configuração gravada, `GET` SHALL devolver os quatro lembretes padrão (3 dias antes, no dia, 3 e 10 dias depois). O texto SHALL aceitar somente as variáveis `{nome}`, `{valor}`, `{vencimento}`, `{imóvel}`, `{mês}`, `{pix}` e `{link}`; outra variável, dias repetidos ou fora da faixa, lista vazia ou acima de 8 SHALL dar 400 `INVALID_REMINDERS`.

#### Scenario: Sem configuração
- **WHEN** uma organização nova consulta os lembretes
- **THEN** recebe os quatro padrões, ordenados por dias

#### Scenario: Salvar a lista
- **WHEN** o dono salva três lembretes válidos
- **THEN** a consulta seguinte devolve exatamente esses três, ordenados por dias, e os anteriores ficam desativados

#### Scenario: Variável desconhecida
- **WHEN** o texto traz `{nom}`
- **THEN** a resposta é 400 `INVALID_REMINDERS` citando `{nom}` e nada muda

#### Scenario: Dias repetidos
- **WHEN** dois lembretes têm 0 dia
- **THEN** a resposta é 400 `INVALID_REMINDERS`

#### Scenario: Sem permissão
- **WHEN** um papel sem `org:update` tenta salvar
- **THEN** a resposta é 403

#### Scenario: Outra organização
- **WHEN** outra organização consulta os lembretes
- **THEN** não vê os da primeira

### Requirement: Escolha do modelo pelo vencimento
O modelo usado para uma cobrança SHALL ser o do lembrete de maior número de dias menor ou igual aos dias desde o vencimento (negativo antes de vencer); se a cobrança está mais cedo que todos, o de menor número de dias.

#### Scenario: Antes do primeiro lembrete
- **WHEN** faltam 5 dias e o primeiro lembrete é de -3
- **THEN** vale o lembrete de -3

#### Scenario: Atraso entre dois lembretes
- **WHEN** a cobrança está 6 dias atrasada e há lembretes de +3 e +10
- **THEN** vale o de +3

### Requirement: Tela de mensagens e cobrança
O frontend SHALL oferecer `/settings/messages` com a lista de lembretes por dias, "Adicionar lembrete" (até 8), painel de edição com nome, quando, texto, variáveis que se inserem ao toque e prévia com dados de exemplo, e "Remover" (a lista não pode ficar vazia).

#### Scenario: Inserir variável
- **WHEN** o dono toca em `{valor}` no editor
- **THEN** a variável entra no texto e a prévia mostra "R$ 1.850,00"

#### Scenario: Remover o último
- **WHEN** só resta um lembrete
- **THEN** "Remover" fica desabilitado

#### Scenario: Falha ao carregar
- **WHEN** a consulta dos lembretes falha
- **THEN** a tela mostra "Não foi possível carregar as mensagens" com tentar de novo
