# pix-payload Specification

## Purpose
TBD - created by archiving change cobranca-manual. Update Purpose after archive.
## Requirements
### Requirement: Pix copia-e-cola da cobrança
O sistema SHALL gerar em `GET /api/v1/payments/{id}/pix` o código Pix copia-e-cola estático (BR Code) com a chave Pix da unidade do contrato, ou da organização, ou da configuração financeira antiga (nessa ordem), o nome e a cidade da conta escolhida (ou, se vazios, o nome do dono e a cidade do imóvel) e o valor atualizado do dia, incluindo o CRC16 correto, sem usar provedor de pagamento. A resposta SHALL informar também o nome do recebedor (`receiver_name`).

#### Scenario: Cobrança em dia
- **WHEN** a cobrança de R$ 1.850,00 está a vencer e a chave Pix está cadastrada
- **THEN** o payload leva o valor 1850.00 e termina com o CRC16 válido

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança está atrasada
- **THEN** o payload leva o total atualizado com multa e juros do dia

#### Scenario: Sem chave Pix
- **WHEN** a organização não tem chave Pix cadastrada
- **THEN** o sistema retorna 422 `PIX_KEY_NOT_CONFIGURED`

#### Scenario: Cobrança paga
- **WHEN** a cobrança já está `PAID`
- **THEN** o sistema retorna 409

#### Scenario: Conta própria da unidade
- **WHEN** a unidade do contrato tem conta Pix ativa
- **THEN** o payload usa a chave e o nome dessa conta, e `receiver_name` traz esse nome

