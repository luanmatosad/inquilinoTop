## ADDED Requirements

### Requirement: Acordo de atraso
O sistema SHALL aceitar `POST /api/v1/payments/{id}/agreement` com `new_due_date` posterior a hoje, `agreed_amount` positivo opcional e `note`, atualizando o vencimento e o valor da cobrança aberta, preservando o vencimento original e registrando o evento `AGREEMENT` com os valores anteriores.

#### Scenario: Nova data
- **WHEN** a cobrança atrasada de R$ 1.550,00 recebe acordo com nova data 12/11
- **THEN** o vencimento passa a 12/11, a cobrança deixa de estar atrasada e o evento guarda o vencimento e o valor anteriores

#### Scenario: Valor combinado
- **WHEN** o acordo informa `agreed_amount` 1.585,13
- **THEN** o valor da cobrança passa a 1.585,13

#### Scenario: Valor omitido
- **WHEN** o acordo não informa `agreed_amount`
- **THEN** o valor combinado é o total atualizado de hoje (bruto, multa e juros)

#### Scenario: Data inválida
- **WHEN** `new_due_date` é hoje ou anterior
- **THEN** o sistema retorna 400

#### Scenario: Cobrança paga
- **WHEN** a cobrança já está `PAID`
- **THEN** o sistema retorna 409

#### Scenario: Cobrança emitida pelo provedor
- **WHEN** a cobrança tem `charge_id`
- **THEN** o sistema retorna 409 `PAYMENT_HAS_CHARGE`

#### Scenario: Volta a atrasar
- **WHEN** a nova data passa sem pagamento
- **THEN** a cobrança volta a `LATE` e multa e juros contam a partir da nova data

#### Scenario: Sem remoção
- **WHEN** o acordo é gravado
- **THEN** nenhuma cobrança é removida
