## ADDED Requirements

### Requirement: Fechar o mês a partir de Recebimentos
Recebimentos de um mês passado SHALL mostrar a ação **Fechar {mês}** (que leva ao fechamento) se o mês está aberto, ou o selo **Mês fechado** se está fechado; meses corrente e futuros não mostram nenhum dos dois.

#### Scenario: Mês passado aberto
- **WHEN** o dono vê Recebimentos de outubro com novembro em curso e outubro aberto
- **THEN** aparece "Fechar outubro"
