## MODIFIED Requirements

### Requirement: Fique de olho
A lista SHALL trazer os contratos ativos com reajuste pendente ou dentro dos dias de aviso das Regras financeiras (60 por padrão; "Reajuste do {unidade} chega em dd/mm", com o índice do contrato, sem percentual calculado, e a ação Revisar reajuste levando a `/leases/{id}?reajustar=1`) e os contratos ativos com término nos próximos 60 dias ("termina em N dias", com "Ver contrato"). Se as regras não puderem ser lidas, a janela do reajuste SHALL ser de 60 dias.

#### Scenario: Contrato terminando
- **WHEN** um contrato ativo termina em 28 dias
- **THEN** aparece "Contrato do {unidade} termina em 28 dias" com a data e a ação Ver contrato

#### Scenario: Aviso do reajuste nos dias configurados
- **WHEN** as regras avisam com 45 dias e um reajuste está a 50 dias
- **THEN** ele ainda não aparece, e aparece quando faltarem 45 dias ou menos

#### Scenario: Regras indisponíveis
- **WHEN** a busca das regras falha
- **THEN** Hoje usa a janela de 60 dias e continua carregando
