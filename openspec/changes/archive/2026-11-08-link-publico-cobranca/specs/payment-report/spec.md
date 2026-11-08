## ADDED Requirements

### Requirement: Inquilino avisa que pagou
O sistema SHALL aceitar `POST /api/v1/public/payments/{token}/report` (multipart) com `amount` (> 0), `paid_date` (não futura e até 60 dias atrás) e `proof` opcional, gravar `reported_at`, `reported_amount`, `reported_date`, o evento `REPORTED`. O sistema SHALL recusar cobrança paga (409) e limitar a 5 avisos por hora por token. Um novo aviso SHALL substituir o anterior e apagar o comprovante antigo.

#### Scenario: Aviso válido
- **WHEN** o inquilino informa R$ 1.850,00 e a data de hoje
- **THEN** a cobrança passa a "Aguardando confirmação"

#### Scenario: Cobrança já paga
- **WHEN** o inquilino avisa numa cobrança paga
- **THEN** o sistema retorna 409 e não grava nada

#### Scenario: Data futura
- **WHEN** o inquilino informa uma data de amanhã
- **THEN** o sistema retorna 400 `INVALID_PAID_DATE`

### Requirement: Comprovante seguro
O sistema SHALL aceitar comprovante de até 5 MB, apenas JPEG, PNG ou PDF, detectado pelo conteúdo, gravá-lo com nome aleatório e SHALL NOT servi-lo em nenhuma rota pública.

#### Scenario: Arquivo grande
- **WHEN** o inquilino envia 8 MB
- **THEN** o sistema retorna 413 `PROOF_TOO_LARGE`

#### Scenario: Tipo falso
- **WHEN** o inquilino envia um executável renomeado para `.pdf`
- **THEN** o sistema retorna 415 `PROOF_TYPE_NOT_ALLOWED`

### Requirement: Dono vê o comprovante
O sistema SHALL oferecer `GET /api/v1/payments/{id}/proof` autenticado, escopado à organização, que devolve o arquivo do aviso pendente.

#### Scenario: Outra organização
- **WHEN** um usuário de outra organização pede o comprovante
- **THEN** o sistema retorna 404

### Requirement: Dono confirma o recebimento
O sistema SHALL oferecer `POST /api/v1/payments/{id}/confirm-report`, que baixa a cobrança pelo mesmo caminho de `MarkPaid` (método `PIX`, data e valor do aviso, desconto opcional) ; o comprovante continua disponível ao dono; exige aviso pendente (409 sem aviso).

#### Scenario: Confirmar
- **WHEN** o dono confirma um aviso de R$ 1.850,00
- **THEN** a cobrança fica `PAID`, ganha número de recibo e o link público mostra o recibo

### Requirement: Dono recusa o aviso
O sistema SHALL oferecer `POST /api/v1/payments/{id}/reject-report`, que limpa `reported_*`, apaga o comprovante, grava `REJECTED` e devolve a cobrança à situação anterior (`PENDING` ou `LATE`); exige aviso pendente.

#### Scenario: Ainda não recebi
- **WHEN** o dono recusa um aviso
- **THEN** a cobrança deixa de estar "Aguardando confirmação" e a linha do tempo mostra a recusa

### Requirement: Situação derivada
A situação "Aguardando confirmação" SHALL ser calculada na leitura (cobrança não paga com `reported_at` preenchido) e SHALL NOT ser gravada em `status`.

#### Scenario: Filtro
- **WHEN** a lista é filtrada por `AWAITING_CONFIRMATION`
- **THEN** só voltam cobranças não pagas com aviso pendente
