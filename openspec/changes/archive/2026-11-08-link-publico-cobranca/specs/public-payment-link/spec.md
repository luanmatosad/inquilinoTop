## ADDED Requirements

### Requirement: Criar e rotacionar o link da cobrança
O sistema SHALL oferecer `POST /api/v1/payments/{id}/link` (autenticado, escopo da organização) que cria um link público para a cobrança e devolve a URL `<APP_PUBLIC_URL>/p/<token>` uma única vez. O token SHALL ter 32 bytes aleatórios e o banco SHALL guardar apenas o hash SHA-256. Se já existe link ativo, o sistema SHALL revogá-lo e criar outro. Cobrança paga também recebe link (a página mostra o recibo). O sistema SHALL responder 422 `PUBLIC_URL_NOT_CONFIGURED` se `APP_PUBLIC_URL` faltar.

#### Scenario: Primeiro envio
- **WHEN** o dono pede o link de uma cobrança sem link
- **THEN** o sistema cria o link e devolve a URL com o token

#### Scenario: Reenvio
- **WHEN** o dono pede o link de uma cobrança que já tem link ativo
- **THEN** o link anterior é revogado e um novo é devolvido

#### Scenario: Outra organização
- **WHEN** o dono pede o link de uma cobrança de outra organização
- **THEN** o sistema retorna 404

### Requirement: Validade do link
O sistema SHALL definir `expires_at` como vencimento + 90 dias (no mínimo hoje + 30 dias), estendê-lo para `paid_date` + 365 dias quando a cobrança for paga e recalculá-lo quando houver acordo.

#### Scenario: Link vencido
- **WHEN** o inquilino abre um link depois de `expires_at`
- **THEN** o sistema responde 404 `NOT_FOUND`

#### Scenario: Cobrança paga
- **WHEN** a cobrança é paga
- **THEN** o link passa a valer até 365 dias depois do pagamento

### Requirement: Leitura pública da cobrança
O sistema SHALL responder `GET /api/v1/public/payments/{token}` sem autenticação, com nome do locador, valor atualizado do dia, vencimento, rótulo da unidade, competência, situação (`PENDING`, `LATE`, `AWAITING_CONFIRMATION`, `PAID`) e, se paga, a data e o número do recibo. O sistema SHALL NOT devolver CPF/CNPJ, endereço, e-mail, telefone, ids internos nem outras cobranças.

#### Scenario: Cobrança em aberto
- **WHEN** o inquilino abre o link de uma cobrança vencida
- **THEN** recebe o valor com multa e juros do dia e a situação `LATE`

#### Scenario: Dados protegidos
- **WHEN** a resposta pública é inspecionada
- **THEN** não contém documento, endereço, e-mail, telefone nem ids de contrato ou inquilino

### Requirement: Token inválido indistinguível
O sistema SHALL responder 404 `NOT_FOUND` idêntico para token inexistente, expirado ou revogado.

#### Scenario: Token revogado
- **WHEN** o inquilino abre um link rotacionado
- **THEN** a resposta é igual à de um token que nunca existiu

### Requirement: Pix e recibo públicos
O sistema SHALL responder `GET /api/v1/public/payments/{token}/pix` com o copia-e-cola do dia (409 se paga, 422 se a chave Pix não estiver configurada) e `GET /api/v1/public/payments/{token}/receipt` com o recibo numerado somente se a cobrança estiver paga (409 caso contrário), sem documentos das partes nem endereço do imóvel.

#### Scenario: Recibo antes do pagamento
- **WHEN** o inquilino pede o recibo de uma cobrança não paga
- **THEN** o sistema retorna 409

### Requirement: Proteções da rota anônima
As rotas `/api/v1/public/` SHALL ter rate limit de 30 requisições por minuto por IP, e as respostas SHALL levar `Cache-Control: no-store`. A página `/p/<token>` SHALL ser `noindex` e enviar `Referrer-Policy: no-referrer`, e SHALL abrir sem login nem Sidebar.

#### Scenario: Excesso de requisições
- **WHEN** um IP passa de 30 requisições por minuto nas rotas públicas
- **THEN** o sistema retorna 429
