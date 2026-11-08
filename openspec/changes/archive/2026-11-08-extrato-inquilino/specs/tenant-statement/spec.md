## ADDED Requirements

### Requirement: Extrato do inquilino
O frontend SHALL oferecer `/tenants/{id}/extrato` com o cabeçalho do inquilino (nome, "Unidade · Imóvel", início do contrato e situação de cobrança), as abas Resumo e Extrato, os indicadores, o filtro de período, a tabela de pagamentos e os cartões Contrato, Reajustes e Acordos, no desktop e no celular.

#### Scenario: Abrir o extrato
- **WHEN** o dono abre a aba Extrato de um inquilino com contrato
- **THEN** vê os indicadores e os pagamentos dos últimos 12 meses

#### Scenario: Inquilino sem contrato
- **WHEN** o inquilino não tem contrato
- **THEN** o extrato mostra "Sem contrato" e nenhum indicador

### Requirement: Período do extrato
O extrato SHALL listar as cobranças de aluguel com vencimento no período: por padrão os últimos 12 meses (do mês de 11 meses atrás até o mês corrente, em São Paulo), ou o ano corrente (`?periodo=AAAA`), ou um intervalo de meses (`?periodo=custom&de=AAAA-MM&ate=AAAA-MM`). Período inválido ou invertido SHALL voltar a 12 meses.

#### Scenario: Últimos 12 meses
- **WHEN** hoje é 07/11/2026
- **THEN** o período vai de 01/12/2025 a 30/11/2026, incluindo a cobrança de novembro ainda prevista

#### Scenario: Intervalo invertido
- **WHEN** `de` é posterior a `ate`
- **THEN** o extrato usa os últimos 12 meses

### Requirement: Situação de cada pagamento
Cada linha SHALL mostrar Pago (paga até o vencimento), Pago com atraso (paga depois), Atrasado, Aguardando confirmação (aviso pendente) ou Previsto, com o vencimento, a data do pagamento e o valor (líquido quando paga, bruto nas demais).

#### Scenario: Pago com atraso
- **WHEN** uma cobrança venceu em 25/08 e foi paga em 27/08
- **THEN** a linha mostra "Pago com atraso" e o valor líquido pago

### Requirement: Indicadores
O extrato SHALL mostrar Recebido (soma do líquido das pagas e quantas), Pontualidade ("X de Y pagos até o vencimento", e quantos pagos com atraso) e, havendo cobrança atrasada, Em atraso agora (total com multa e juros e "N dias · mês" da mais antiga); sem atraso, Atrasos (pagas com atraso no período).

#### Scenario: Inquilino em dia
- **WHEN** as 12 cobranças foram pagas até o vencimento
- **THEN** Pontualidade mostra "12 de 12" e Atrasos mostra "0"

#### Scenario: Inquilino com atraso
- **WHEN** há uma cobrança atrasada há 8 dias
- **THEN** o terceiro cartão mostra Em atraso agora com o total atualizado e "8 dias"

### Requirement: Contrato, reajustes e acordos
O extrato SHALL mostrar o contrato atual (aluguel, dia de vencimento, próximo reajuste), o histórico de reajustes (mês e novo aluguel) e os acordos do período (cobranças que mudaram de vencimento); sem acordos, "Nenhum acordo registrado".

#### Scenario: Acordo
- **WHEN** uma cobrança do período tem vencimento original diferente do atual
- **THEN** o cartão Acordos mostra o vencimento original e o novo

### Requirement: Linhas visíveis e ações
O extrato SHALL mostrar as seis cobranças mais recentes com "Mostrando N dos M meses" e Ver todos, e SHALL oferecer Exportar PDF (impressão do navegador) e Cobrar, que leva à cobrança aberta mais antiga com o envio aberto e some se não há cobrança aberta.

#### Scenario: Ver todos
- **WHEN** o dono escolhe Ver todos
- **THEN** a tabela lista todas as cobranças do período
