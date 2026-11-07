## ADDED Requirements

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
O frontend SHALL permitir registrar o pagamento de uma cobrança aberta pela linha ou pelo botão do topo, com a data do pagamento, e SHALL mostrar o valor atualizado com multa e juros quando a cobrança estiver atrasada.

#### Scenario: Pela linha
- **WHEN** o usuário aciona "Registrar pagamento" na linha de uma cobrança `PENDING`
- **THEN** o diálogo abre com essa cobrança escolhida e a data de hoje

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança está `LATE`
- **THEN** o diálogo mostra o valor bruto e o total atualizado com multa e juros

#### Scenario: Pelo topo
- **WHEN** o usuário aciona "Registrar pagamento" no topo
- **THEN** o diálogo lista as cobranças abertas para escolher

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
