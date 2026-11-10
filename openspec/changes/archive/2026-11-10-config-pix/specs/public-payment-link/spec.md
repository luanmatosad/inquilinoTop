## MODIFIED Requirements

### Requirement: Pix e recibo públicos
O sistema SHALL responder `GET /api/v1/public/payments/{token}/pix` com o copia-e-cola do dia e o nome do recebedor (409 se paga, 422 se a chave Pix não estiver configurada) e `GET /api/v1/public/payments/{token}/receipt` com o recibo numerado somente se a cobrança estiver paga (409 caso contrário), sem documentos das partes nem endereço do imóvel. A página pública SHALL mostrar "Pague para {nome}" junto do QR Code.

#### Scenario: Recibo antes do pagamento
- **WHEN** o inquilino pede o recibo de uma cobrança não paga
- **THEN** o sistema retorna 409

#### Scenario: Nome de quem recebe
- **WHEN** o inquilino abre uma cobrança com Pix configurado
- **THEN** vê "Pague para" seguido do nome do recebedor antes de copiar o código
