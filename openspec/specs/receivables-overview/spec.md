# receivables-overview Specification

## Purpose
TBD - created by archiving change redesign-financeiro. Update Purpose after archive.
## Requirements
### Requirement: Mês da lista
O frontend SHALL mostrar os Recebimentos de um mês, escolhido por `?mes=AAAA-MM`, usando o mês corrente em `America/Sao_Paulo` quando o parâmetro falta ou é inválido, com navegação para o mês anterior e o próximo.

#### Scenario: Mês padrão
- **WHEN** o usuário abre `/financial/receivables` em 07/11/2026
- **THEN** a tela mostra "Novembro de 2026"

#### Scenario: Mês inválido
- **WHEN** `?mes=abc`
- **THEN** a tela mostra o mês corrente

#### Scenario: Mês anterior
- **WHEN** o usuário aciona o mês anterior
- **THEN** a URL passa a `?mes=2026-10` e a lista mostra outubro

### Requirement: Linhas de Recebimentos
O frontend SHALL listar as cobranças `RENT` com vencimento no mês e as `LATE` de qualquer mês, sem repetir nenhuma, cada linha com inquilino, unidade e imóvel, vencimento, valor bruto e situação (Atrasado, Pago ou Previsto), juntando a cobrança ao contrato, ao inquilino e à unidade.

#### Scenario: Linha completa
- **WHEN** a cobrança de R$ 1.850,00 vence em 05/11 no contrato da Marina Souza no Ap 302 do Ed. Aurora e está paga
- **THEN** a linha mostra "Marina Souza", "Ap 302 · Ed. Aurora", "05/11", "R$ 1.850,00" e "Pago"

#### Scenario: Atraso de outro mês
- **WHEN** há cobrança `LATE` com vencimento em 25/10 e o mês é novembro
- **THEN** ela aparece uma vez, como Atrasado

#### Scenario: Só aluguel
- **WHEN** o mês tem cobranças `EXPENSE` e `DEPOSIT`
- **THEN** elas não aparecem na lista

#### Scenario: Dados auxiliares ausentes
- **WHEN** o contrato, o inquilino ou a unidade da cobrança não são encontrados
- **THEN** a linha mostra "—" no lugar do que falta, sem erro

### Requirement: Indicadores de Recebimentos
O frontend SHALL calcular, sobre as linhas exibidas, Previsto (soma do valor bruto e quantidade), Recebido (soma das pagas e "X de N pagas") e Em atraso (soma das atrasadas e quantidade).

#### Scenario: Indicadores do canvas
- **WHEN** as linhas são 1.850 (pago), 1.600, 1.550 (atrasada), 2.200 (paga) e 1.100
- **THEN** Previsto mostra R$ 8.300,00 e "5 cobranças", Recebido R$ 4.050,00 e "2 de 5 pagas", e Em atraso R$ 1.550,00 e "1 cobrança"

#### Scenario: Sem atrasadas
- **WHEN** nenhuma linha está atrasada
- **THEN** Em atraso mostra R$ 0,00 e "nenhuma cobrança"

### Requirement: Filtro por situação
O frontend SHALL oferecer os chips Todas, Atrasadas, Pagas e Previstas, com a contagem de cada um, guardando a escolha em `?situacao=LATE|PAID|PENDING` e mantendo o mês, e SHALL NOT oferecer "Aguardando confirmação".

#### Scenario: Filtrar atrasadas
- **WHEN** o usuário escolhe Atrasadas
- **THEN** só as atrasadas aparecem e a URL guarda `?situacao=LATE`

#### Scenario: Nada no filtro
- **WHEN** o filtro não encontra linhas
- **THEN** a tela mostra "Nenhuma cobrança encontrada."

### Requirement: Registrar pagamento
O frontend SHALL permitir registrar o pagamento de uma cobrança aberta pelo detalhe ou pelo botão do topo, com a data do pagamento, a forma de pagamento, um desconto opcional e uma observação opcional, e SHALL mostrar o valor atualizado com multa e juros quando a cobrança estiver atrasada e o saldo depois do desconto.

#### Scenario: Pelo detalhe
- **WHEN** o usuário aciona "Registrar pagamento" no detalhe de uma cobrança `PENDING`
- **THEN** o diálogo abre com essa cobrança escolhida, a data de hoje e a forma Pix

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança está `LATE`
- **THEN** o diálogo mostra o valor bruto e o total atualizado com multa e juros

#### Scenario: Pelo topo
- **WHEN** o usuário aciona "Registrar pagamento" no topo
- **THEN** o diálogo lista as cobranças abertas para escolher

#### Scenario: Desconto e forma
- **WHEN** o usuário escolhe "Dinheiro" e informa desconto de R$ 50,00
- **THEN** o pedido leva a forma e o desconto, e o diálogo mostra o total a receber já com o abatimento

#### Scenario: Desconto inválido
- **WHEN** o desconto é maior que o total devido
- **THEN** o diálogo mostra o erro e não envia

#### Scenario: Sucesso
- **WHEN** a baixa é confirmada
- **THEN** a linha passa a Pago, com o link Recibo, e os indicadores se atualizam

### Requirement: Estados e celular
A tela SHALL mostrar o convite para criar contrato quando o mês não tem cobranças e nada está atrasado, a mensagem de erro com nova tentativa quando as cobranças falham, o aviso de dados parciais quando contratos, inquilinos ou imóveis falham, e cards no lugar da tabela abaixo de 768px.

#### Scenario: Mês sem cobranças
- **WHEN** não há linhas no mês
- **THEN** a tela explica que as cobranças nascem dos contratos e liga para `/leases`

#### Scenario: Erro nas cobranças
- **WHEN** a busca de cobranças falha
- **THEN** a tela mostra "Não foi possível carregar os recebimentos." e "Tentar novamente"

#### Scenario: Celular
- **WHEN** a largura é menor que 768px
- **THEN** cada cobrança aparece num card

### Requirement: Ações da linha e acesso ao detalhe
O frontend SHALL ligar o nome do inquilino de cada linha ao detalhe da cobrança e mostrar a ação do canvas: "Enviar cobrança" para Previsto, "Cobrar" para Atrasado e "Recibo" para Pago, sendo que "Enviar cobrança" e "Cobrar" levam ao envio no detalhe.

#### Scenario: Previsto
- **WHEN** a cobrança está Prevista
- **THEN** a linha mostra "Enviar cobrança" apontando para `?enviar=1` do detalhe

#### Scenario: Atrasado
- **WHEN** a cobrança está Atrasada
- **THEN** a linha mostra "Cobrar" apontando para `?enviar=1` do detalhe

#### Scenario: Pago
- **WHEN** a cobrança está Paga
- **THEN** a linha mostra "Recibo"

#### Scenario: Detalhe
- **WHEN** o usuário aciona o nome do inquilino
- **THEN** abre `/financial/receivables/<id>`

### Requirement: Aguardando confirmação em Recebimentos
A tela de Recebimentos SHALL mostrar o chip "Aguardando confirmação" com a contagem, o selo na linha das cobranças com aviso pendente e a ação Confirmar, que abre o diálogo com quem informou, quando, o valor, o comprovante, o texto "O comprovante é informado pelo inquilino. O ImoviFlow não verifica se o dinheiro entrou." e as ações "Ainda não recebi" e "Confirmar recebimento".

#### Scenario: Cobrança com aviso
- **WHEN** uma cobrança tem aviso pendente
- **THEN** a linha mostra o selo "Aguardando confirmação" e o botão Confirmar

#### Scenario: Confirmar
- **WHEN** o dono clica em "Confirmar recebimento"
- **THEN** a cobrança passa a Pago e a linha mostra a ação Recibo

### Requirement: Fechar o mês a partir de Recebimentos
Recebimentos de um mês passado SHALL mostrar a ação **Fechar {mês}** (que leva ao fechamento) se o mês está aberto, ou o selo **Mês fechado** se está fechado; meses corrente e futuros não mostram nenhum dos dois.

#### Scenario: Mês passado aberto
- **WHEN** o dono vê Recebimentos de outubro com novembro em curso e outubro aberto
- **THEN** aparece "Fechar outubro"

