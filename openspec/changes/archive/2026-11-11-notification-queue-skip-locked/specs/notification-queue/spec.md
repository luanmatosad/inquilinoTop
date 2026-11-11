# Spec Delta

## Purpose

Define como o worker de notificações entrega mensagens pendentes quando há mais de uma instância da API em execução. Garante que uma notificação não seja enviada por duas instâncias ao mesmo tempo, sem alterar o formato de status nem a API HTTP.

## ADDED Requirements

### Requirement: Exclusão mútua por notificação
O worker SHALL reservar cada notificação pendente antes de enviá-la. Enquanto uma instância mantém a reserva, outra instância MUST NOT enviar a mesma notificação e MUST pular essa linha sem esperar.

#### Scenario: Duas instâncias disputam a mesma notificação
- **WHEN** duas instâncias processam a fila ao mesmo tempo e existe uma notificação `pending` elegível
- **THEN** exatamente uma instância envia o e-mail
- **AND** a outra pula a linha sem bloquear

#### Scenario: Notificação já enviada por outra instância
- **WHEN** uma instância lista uma notificação como `pending`, mas outra instância a enviou e confirmou antes da reserva
- **THEN** a instância que chegou depois não envia novamente
- **AND** a linha permanece `sent` com o `sent_at` gravado pela primeira instância

### Requirement: Sucesso marca a notificação como enviada
Após envio bem-sucedido, o worker SHALL gravar `status = sent` e `sent_at` com o instante do envio, na mesma unidade de trabalho que liberou a reserva.

#### Scenario: Envio com sucesso
- **WHEN** o provedor de e-mail aceita o envio de uma notificação `pending`
- **THEN** a notificação passa a `sent` com `sent_at` preenchido
- **AND** em seguida a reserva é liberada

### Requirement: Falha mantém a notificação pendente e incrementa tentativas
Quando o envio falha, o worker SHALL incrementar `retry_count` e manter `status = pending`, sem gravar `sent_at`. Não há limite máximo de tentativas nesta mudança.

#### Scenario: Falha no provedor
- **WHEN** o envio de uma notificação `pending` retorna erro
- **THEN** `retry_count` é incrementado em 1
- **AND** `status` continua `pending`
- **AND** `sent_at` continua nulo
- **AND** a notificação volta a ser elegível na próxima rodada do worker

### Requirement: Agendamento futuro não é processado
O worker MUST NOT enviar notificações cujo `scheduled_at` esteja no futuro, nem notificações sem `owner_id`.

#### Scenario: Notificação agendada para depois
- **WHEN** uma notificação `pending` tem `scheduled_at` posterior ao instante atual
- **THEN** o worker não a envia nesta rodada

### Requirement: Falha de leitura da fila não derruba o worker
Erros ao listar ou reservar notificações SHALL ser registrados em log e a próxima rodada do worker SHALL ocorrer normalmente.

#### Scenario: Erro de banco na listagem
- **WHEN** a consulta de candidatos falha
- **THEN** o erro é registrado
- **AND** o worker tenta novamente no próximo intervalo
