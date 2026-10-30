# lease-management Specification

## Purpose
TBD - created by archiving change mvp-contratos. Update Purpose after archive.
## Requirements
### Requirement: Criar contrato válido
O sistema SHALL criar contrato apenas com unidade e inquilino ativos da organização do usuário, `start_date`, valor do aluguel e `payment_day` entre 1 e 31, com `end_date` posterior a `start_date` quando informada.

#### Scenario: Criação bem-sucedida
- **WHEN** o usuário envia unidade e inquilino válidos, datas coerentes e aluguel
- **THEN** o sistema cria o contrato com status `ACTIVE` e retorna 201

#### Scenario: Datas incoerentes
- **WHEN** `end_date` é igual ou anterior a `start_date`
- **THEN** o sistema retorna 422 e não cria o contrato

#### Scenario: Unidade ou inquilino inválido
- **WHEN** a unidade ou o inquilino pertence a outra organização ou está excluído
- **THEN** o sistema retorna 404 e não cria o contrato

### Requirement: Um contrato ativo por unidade
O sistema SHALL impedir que uma unidade tenha dois contratos `ACTIVE` com períodos sobrepostos, tratando `end_date` nulo como período aberto.

#### Scenario: Sobreposição
- **WHEN** o usuário cria contrato para unidade que já tem contrato ativo no mesmo período
- **THEN** o sistema retorna 409 `LEASE_OVERLAP`

#### Scenario: Período sequencial
- **WHEN** o novo contrato começa depois do fim do contrato ativo
- **THEN** o sistema cria o contrato

#### Scenario: Requisições simultâneas
- **WHEN** duas criações sobrepostas chegam ao mesmo tempo
- **THEN** apenas uma é aceita e a outra recebe 409

### Requirement: Observações do contrato
O sistema SHALL armazenar `notes` opcional de até 2000 caracteres no contrato.

#### Scenario: Notas salvas
- **WHEN** o usuário envia `notes` ao criar ou atualizar
- **THEN** a resposta inclui o mesmo texto

### Requirement: Gerar cobranças ao criar
O sistema SHALL, quando `generate_payments=true`, gerar as cobranças de aluguel por competência do início até `end_date`, limitado a 12 meses quando o contrato é aberto.

#### Scenario: Contrato com prazo
- **WHEN** o contrato de 6 meses é criado com `generate_payments=true`
- **THEN** existem 6 cobranças `RENT` `PENDING`, uma por competência, no `payment_day`

#### Scenario: Contrato aberto
- **WHEN** o contrato sem `end_date` é criado com `generate_payments=true`
- **THEN** são geradas 12 cobranças

#### Scenario: Idempotência
- **WHEN** a geração é solicitada de novo para as mesmas competências
- **THEN** nenhuma cobrança duplicada é criada

### Requirement: Encerrar contrato
O sistema SHALL encerrar contrato `ACTIVE` mudando o status para `ENDED` e desativando as cobranças futuras `PENDING` sem cobrança emitida, preservando as pagas e as vencidas.

#### Scenario: Encerramento
- **WHEN** o usuário encerra um contrato com cobranças futuras pendentes
- **THEN** o contrato fica `ENDED` e essas cobranças deixam de aparecer em contas a receber

#### Scenario: Cobrança já emitida
- **WHEN** uma cobrança futura pendente tem `charge_id`
- **THEN** ela é mantida e a resposta sinaliza que precisa de decisão manual

#### Scenario: Contrato já encerrado
- **WHEN** o usuário tenta encerrar contrato `ENDED`
- **THEN** o sistema retorna 409 `LEASE_NOT_ACTIVE`

### Requirement: Renovar e reajustar
O sistema SHALL renovar contrato `ACTIVE` com nova data final e, opcionalmente, novo aluguel e dia de pagamento, e reajustar o aluguel com percentual entre 0 (exclusivo) e 1 (inclusivo), registrando histórico.

#### Scenario: Renovação sem sobreposição
- **WHEN** o usuário renova com `new_end_date` posterior ao atual
- **THEN** o contrato é atualizado e permanece `ACTIVE`

#### Scenario: Renovação inválida
- **WHEN** `new_end_date` é anterior ao `end_date` atual
- **THEN** o sistema retorna 422

#### Scenario: Reajuste
- **WHEN** o usuário aplica reajuste de 5% (0,05) a um contrato ativo
- **THEN** o aluguel aumenta 5%, o histórico registra o reajuste e cobranças já geradas não mudam

### Requirement: Isolamento e exclusão lógica
O sistema SHALL filtrar contratos por `organization_id` e excluir apenas com `is_active=false`.

#### Scenario: Contrato de outra organização
- **WHEN** o usuário acessa contrato de outra organização
- **THEN** o sistema retorna 404

### Requirement: Telas de contrato no frontend
O frontend SHALL oferecer em `/leases/**` lista, criação, detalhe com abas (dados, cobranças, reajustes) e ações de encerrar, renovar e reajustar, com confirmação nas ações destrutivas.

#### Scenario: Detalhe com cobranças
- **WHEN** o usuário abre um contrato
- **THEN** vê as cobranças do contrato com vencimento, valor e status

#### Scenario: Erro de sobreposição na tela
- **WHEN** o backend retorna `LEASE_OVERLAP`
- **THEN** o formulário explica que a unidade já tem contrato ativo no período

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/contracts`
- **THEN** é redirecionado permanentemente para `/leases`

