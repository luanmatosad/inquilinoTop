# payables-overview Specification

## Purpose
TBD - created by archiving change redesign-financeiro. Update Purpose after archive.
## Requirements
### Requirement: Mês da lista de Despesas
O frontend SHALL mostrar as Despesas de um mês, escolhido por `?mes=AAAA-MM`, com o mês corrente em `America/Sao_Paulo` por padrão e navegação para o mês anterior e o próximo.

#### Scenario: Mês padrão
- **WHEN** o usuário abre `/financial/payables` em 07/11/2026
- **THEN** a tela mostra "Novembro de 2026"

#### Scenario: Mês inválido
- **WHEN** `?mes=2026-13`
- **THEN** a tela mostra o mês corrente

### Requirement: Linhas de Despesas
O frontend SHALL listar as despesas com vencimento no mês e as atrasadas de qualquer mês, sem repetir nenhuma, cada linha com descrição, unidade e imóvel, categoria em português, vencimento, valor e situação (A pagar, Atrasada ou Paga).

#### Scenario: Linha completa
- **WHEN** existe a despesa "Pintura da sala" de R$ 800,00, categoria `MAINTENANCE`, no Ap 302 do Ed. Aurora, vencendo em 12/11
- **THEN** a linha mostra "Pintura da sala", "Ap 302 · Ed. Aurora", "Manutenção", "12/11", "R$ 800,00" e "A pagar"

#### Scenario: Categorias
- **WHEN** as categorias são `ELECTRICITY`, `WATER`, `CONDO`, `TAX`, `MAINTENANCE` e `OTHER`
- **THEN** a tela mostra Energia, Água, Condomínio, Impostos, Manutenção e Outros

#### Scenario: Unidade ausente
- **WHEN** a unidade da despesa não está na lista de imóveis
- **THEN** a linha mostra "—" no lugar da unidade e do imóvel

### Requirement: Indicadores de Despesas
O frontend SHALL calcular, sobre as linhas exibidas, Total do mês (soma e quantidade), Pagas e A pagar (pendentes mais atrasadas).

#### Scenario: Indicadores do canvas
- **WHEN** as linhas são 800 (a pagar), 680, 420 e 240 (pagas)
- **THEN** Total mostra R$ 2.140,00 e "4 despesas", Pagas R$ 1.340,00 e "3 despesas", A pagar R$ 800,00 e "1 despesa"

### Requirement: Filtro por situação de Despesas
O frontend SHALL oferecer os chips Todas, A pagar e Pagas, com contagem, em `?situacao=PENDING|PAID`, onde A pagar inclui as atrasadas.

#### Scenario: A pagar inclui atrasadas
- **WHEN** o usuário escolhe A pagar e há uma despesa atrasada
- **THEN** ela aparece na lista

### Requirement: Lançar despesa em painel
O frontend SHALL abrir o painel Lançar despesa por `?novo=1`, com descrição, unidade, categoria, valor, vencimento e a opção "Já paguei" com a data do pagamento, aceitando `?unidade=<id>` para pré-selecionar, e SHALL NOT oferecer "Repetir todo mês" nem comprovante.

#### Scenario: Pré-seleção
- **WHEN** o usuário abre `/financial/payables?novo=1&unidade=<id>`
- **THEN** a unidade vem escolhida

#### Scenario: Já paguei
- **WHEN** o usuário marca "Já paguei" e informa a data
- **THEN** o pedido leva `paid_date` e a despesa nasce paga

#### Scenario: Validação
- **WHEN** a descrição, a unidade ou o valor faltam
- **THEN** o painel mostra os erros e não envia

#### Scenario: Salvar
- **WHEN** os dados são válidos
- **THEN** a despesa é criada, o painel fecha só o parâmetro da URL e a lista a mostra

### Requirement: Dar baixa e desfazer
O frontend SHALL permitir dar baixa numa despesa aberta, com data e valor opcional, e desfazer o pagamento de uma despesa paga.

#### Scenario: Baixa
- **WHEN** o usuário confirma a baixa com a data
- **THEN** a linha passa a Paga e os indicadores se atualizam

#### Scenario: Desfazer
- **WHEN** o usuário desfaz o pagamento de uma despesa paga
- **THEN** a despesa volta a A pagar

### Requirement: Estados de Despesas
A tela SHALL mostrar o convite para lançar a primeira despesa quando o mês não tem despesas, o erro com nova tentativa quando a busca falha, o aviso quando os imóveis não carregam, e cards no lugar da tabela abaixo de 768px.

#### Scenario: Mês sem despesas
- **WHEN** não há despesas no mês
- **THEN** a tela convida a lançar a primeira despesa

#### Scenario: Erro
- **WHEN** a busca de despesas falha
- **THEN** a tela mostra "Não foi possível carregar as despesas." e "Tentar novamente"

