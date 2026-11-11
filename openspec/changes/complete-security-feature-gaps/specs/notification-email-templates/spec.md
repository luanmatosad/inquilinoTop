# Spec Delta

## Purpose

Templates de e-mail para cobrança e contrato vencendo, e política de retry de envio que termina em estado final observável.

## ADDED Requirements

### Requirement: Templates de e-mail por tipo
O sistema SHALL renderizar e-mails de lembrete de cobrança e de contrato vencendo a partir de templates versionados.

#### Scenario: Lembrete de cobrança renderizado
- **WHEN** uma notificação do tipo lembrete de cobrança é enfileirada
- **THEN** o e-mail contém nome do inquilino, valor e data de vencimento

#### Scenario: Variável ausente
- **WHEN** um template exige uma variável que não está nos dados da notificação
- **THEN** o envio falha sem enviar e-mail parcial, e a notificação registra o erro

### Requirement: Retry com limite e estado final
O sistema SHALL tentar o envio até o limite configurado de tentativas e marcar a notificação como `failed` ao exceder o limite.

#### Scenario: Falha transitória com sucesso posterior
- **WHEN** o envio falha uma vez e na tentativa seguinte é bem-sucedido
- **THEN** a notificação termina como enviada

#### Scenario: Limite de tentativas excedido
- **WHEN** o envio falha até atingir o limite de tentativas
- **THEN** a notificação termina como `failed` e não é reenfileirada automaticamente
