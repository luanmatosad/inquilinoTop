## MODIFIED Requirements

### Requirement: Dados da unidade
O sistema SHALL permitir informar rótulo, andar, área em m², quartos, banheiros e aluguel de referência (opcional) de uma unidade.

#### Scenario: Unidade com área
- **WHEN** o usuário envia rótulo e `area_m2` maior que zero
- **THEN** o sistema cria a unidade com a área informada

#### Scenario: Área negativa
- **WHEN** `area_m2`, `bedrooms` ou `bathrooms` é negativo
- **THEN** o sistema retorna 400

#### Scenario: Aluguel de referência
- **WHEN** o usuário envia `reference_rent` de 1850,00
- **THEN** a unidade é criada e a resposta traz o mesmo valor

#### Scenario: Aluguel de referência negativo
- **WHEN** `reference_rent` é negativo
- **THEN** o sistema retorna 400

#### Scenario: Sem aluguel de referência
- **WHEN** o usuário não envia `reference_rent`
- **THEN** a unidade é criada sem esse campo

#### Scenario: Formulário de unidade
- **WHEN** o painel de unidade é aberto
- **THEN** mostra "Aluguel de referência (opcional)" com a dica "Aparece como sugestão ao criar o contrato."
