## ADDED Requirements

### Requirement: Atualizar Perfil do Proprietário
O sistema SHALL permitir que o proprietário atualize suas informações pessoais e de contato.

#### Scenario: Atualização de dados pessoais
- **WHEN** o proprietário altera seu nome ou telefone na página de configurações e clica em salvar
- **THEN** o sistema atualiza os dados no perfil e exibe mensagem de sucesso

### Requirement: Gerenciar Notificações
O sistema SHALL permitir que o proprietário defina quais eventos disparam notificações (ex: atraso de pagamento, fim de contrato).

#### Scenario: Ativação de alertas
- **WHEN** o proprietário ativa o alerta "Notificar fim de contrato 30 dias antes" e salva
- **THEN** o sistema registra a preferência e passa a enviar as notificações conforme configurado
