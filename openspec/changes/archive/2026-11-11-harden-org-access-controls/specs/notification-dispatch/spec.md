## ADDED Requirements

### Requirement: Envio de notificações sem endpoint HTTP
O sistema SHALL NOT expor endpoint HTTP que dispare o processamento da fila de notificações.

#### Scenario: Chamada à rota removida
- **WHEN** um cliente envia `POST /api/v1/notifications/process`
- **THEN** a resposta não é 2xx: `process` casa com `/notifications/{id}`, que só aceita GET, então responde 405 e nenhum envio é disparado

### Requirement: Worker interno é o único caminho de envio
O worker de notificações SHALL processar notificações pendentes de todas as organizações no intervalo configurado, e nenhuma requisição de API cliente SHALL acionar esse processamento.

#### Scenario: Notificação pendente é enviada pelo worker
- **WHEN** existe uma notificação pendente com `scheduled_at` nulo ou no passado
- **THEN** o worker a envia no próximo ciclo e marca o status como `sent`

#### Scenario: Notificação agendada para o futuro
- **WHEN** existe uma notificação com `scheduled_at` no futuro
- **THEN** o worker não a envia antes desse horário
