# notification-settings Specification

## Purpose
TBD - created by archiving change config-base. Update Purpose after archive.
## Requirements
### Requirement: Tela de notificações
O frontend SHALL oferecer `/settings/notifications` com os avisos "Inquilino avisou que pagou", "Cobrança em atraso" e "Contrato vencendo" (com antecedência de 1 a 90 dias), cada um com um interruptor, e a informação de que as escolhas ficam salvas e os avisos no app chegam em breve. Salvar SHALL manter os campos que a tela não mostra com o valor gravado.

#### Scenario: Desligar um aviso
- **WHEN** o dono desliga "Cobrança em atraso" e salva
- **THEN** `notify_payment_overdue` fica falso e os demais campos, inclusive os que a tela não mostra, ficam como estavam

#### Scenario: Endereço antigo
- **WHEN** o dono abre `/owner/settings`
- **THEN** é levado a `/settings/notifications`

