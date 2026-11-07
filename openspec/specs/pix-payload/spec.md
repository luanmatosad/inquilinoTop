# pix-payload Specification

## Purpose
TBD - created by archiving change cobranca-manual. Update Purpose after archive.
## Requirements
### Requirement: Pix copia-e-cola da cobrança
O sistema SHALL gerar em `GET /api/v1/payments/{id}/pix` o código Pix copia-e-cola estático (BR Code) com a chave Pix da configuração financeira da organização, o nome do dono, a cidade do imóvel e o valor atualizado do dia, incluindo o CRC16 correto, sem usar provedor de pagamento.

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

#### Scenario: Nome e cidade longos
- **WHEN** o nome do dono tem mais de 25 caracteres ou a cidade mais de 15
- **THEN** o payload os trunca e os escreve sem acento e em maiúsculas

#### Scenario: Vetor de referência
- **WHEN** o CRC16-CCITT é calculado sobre "123456789"
- **THEN** o resultado é 29B1

