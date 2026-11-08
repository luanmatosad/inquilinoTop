## ADDED Requirements

### Requirement: Aguardando confirmação em Recebimentos
A tela de Recebimentos SHALL mostrar o chip "Aguardando confirmação" com a contagem, o selo na linha das cobranças com aviso pendente e a ação Confirmar, que abre o diálogo com quem informou, quando, o valor, o comprovante, o texto "O comprovante é informado pelo inquilino. O ImoviFlow não verifica se o dinheiro entrou." e as ações "Ainda não recebi" e "Confirmar recebimento".

#### Scenario: Cobrança com aviso
- **WHEN** uma cobrança tem aviso pendente
- **THEN** a linha mostra o selo "Aguardando confirmação" e o botão Confirmar

#### Scenario: Confirmar
- **WHEN** o dono clica em "Confirmar recebimento"
- **THEN** a cobrança passa a Pago e a linha mostra a ação Recibo
