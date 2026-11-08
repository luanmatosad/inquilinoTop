# month-closing Specification

## Purpose
TBD - created by archiving change fechamento-mes. Update Purpose after archive.
## Requirements
### Requirement: Fechar o mês
O sistema SHALL permitir fechar um mês já encerrado (anterior ao mês corrente em São Paulo), gravando um retrato calculado no servidor: previsto, recebido e em atraso (valor bruto e quantidade, das cobranças `RENT` com vencimento no mês), pendências, recibos emitidos, quem fechou e quando. Fechar SHALL ser recusado para mês corrente ou futuro (422 `MONTH_NOT_ENDED`), mês já fechado (409 `ALREADY_CLOSED`) e formato inválido (400).

#### Scenario: Fechar outubro
- **WHEN** o dono fecha outubro e há 5 cobranças, 4 pagas e 1 atrasada
- **THEN** o retrato guarda previsto 5 cobranças, recebido 4 e em atraso 1, com a pendência listada

#### Scenario: Mês corrente
- **WHEN** o dono tenta fechar o mês corrente
- **THEN** o sistema responde 422 `MONTH_NOT_ENDED`

### Requirement: Pendências não bloqueiam
Cobranças atrasadas e avisos de pagamento ainda não confirmados SHALL aparecer como pendências no retrato e SHALL NOT impedir o fechamento.

#### Scenario: Fechar com pendência
- **WHEN** há um aviso aguardando confirmação e o dono fecha o mês
- **THEN** o mês fecha com 1 pendência marcada como aguardando

### Requirement: Retrato imutável
O retrato SHALL permanecer o mesmo enquanto o mês estiver fechado, mesmo que cobranças do mês mudem depois.

#### Scenario: Pagamento tardio
- **WHEN** uma cobrança pendente é paga depois do fechamento
- **THEN** a consulta do mês fechado continua mostrando os números do fechamento

### Requirement: Reabrir com motivo
O sistema SHALL permitir reabrir um mês fechado com um motivo obrigatório, mantendo o histórico (fechado e reaberto, com autor, data e motivo). Reabrir mês aberto SHALL dar 409 `NOT_CLOSED`. Um mês reaberto SHALL poder ser fechado de novo, gerando novo retrato.

#### Scenario: Reabrir sem motivo
- **WHEN** o dono reabre sem informar o motivo
- **THEN** o sistema responde 400 e o mês segue fechado

### Requirement: Consulta e isolamento
`GET /closings?month=` SHALL devolver o estado do mês (`OPEN` com retrato ao vivo, ou `CLOSED` com o retrato gravado) e o histórico, restrito à organização do usuário.

#### Scenario: Outra organização
- **WHEN** outra organização consulta o mesmo mês
- **THEN** não vê o fechamento nem o histórico da primeira

### Requirement: Tela de fechamento
O frontend SHALL oferecer `/financial/receivables/fechamento?mes=AAAA-MM` com os indicadores, a lista "Antes de fechar" (avisos confirmados, recibos gerados, cobranças em atraso com nomes), confirmação ao fechar, e no mês fechado o modo somente leitura com quem e quando fechou, as pendências, o histórico, Reabrir mês (com motivo) e o resumo em PDF pela impressão do navegador.

#### Scenario: Mês aberto
- **WHEN** o dono abre o fechamento de um mês passado em aberto
- **THEN** vê os números, a conferência e o botão Fechar {mês}

#### Scenario: Mês fechado
- **WHEN** o dono abre um mês fechado
- **THEN** vê "Fechado em dd/mm/aaaa, hh:mm" com o autor, os números do retrato e o botão Reabrir mês

