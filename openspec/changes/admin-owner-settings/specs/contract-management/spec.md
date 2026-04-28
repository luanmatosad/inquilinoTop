## ADDED Requirements

### Requirement: Listar Contratos
O sistema SHALL listar os contratos de locação vinculados às propriedades do owner, permitindo o acompanhamento de vigências.

#### Scenario: Visualizar listagem de contratos
- **WHEN** o proprietário acessa a área de contratos
- **THEN** o sistema exibe a lista contendo imóvel, inquilino associado, datas de início e fim, e status (Ativo, Encerrado, Em Atraso)

### Requirement: Registrar Novo Contrato
O sistema SHALL permitir a criação de um novo vínculo contratual entre um inquilino e um imóvel.

#### Scenario: Criação de contrato com sucesso
- **WHEN** o proprietário preenche inquilino, imóvel, valores e datas e clica em salvar
- **THEN** o sistema cria o contrato e atualiza o status do imóvel para "Alugado"
