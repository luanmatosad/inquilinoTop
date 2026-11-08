## ADDED Requirements

### Requirement: Tela Hoje
A rota `/` SHALL mostrar a saudação por hora (bom dia, boa tarde, boa noite, em São Paulo) com o primeiro nome do perfil, a data por extenso, a frase "Você tem N coisas para resolver hoje." (singular com 1; "Nada para resolver hoje." com 0), os indicadores Previsto, Recebido (com barra de progresso e "de R$ X previstos") e Em atraso (com "a mais antiga há N dias") e as listas Confirmar pagamento, Atrasados, Para cobrar e Fique de olho.

#### Scenario: Dia com pendências
- **WHEN** há 2 avisos, 1 atrasada, 1 a cobrar e 2 itens de atenção
- **THEN** o cabeçalho diz "Você tem 6 coisas para resolver hoje." e cada lista mostra sua contagem

#### Scenario: Nada a fazer
- **WHEN** não há aviso, atraso, cobrança próxima nem item de atenção
- **THEN** o cabeçalho diz "Nada para resolver hoje." e Confirmar pagamento mostra "Nada para confirmar."

#### Scenario: Saudação
- **WHEN** são 08h, 14h e 20h em São Paulo
- **THEN** a saudação é "Bom dia", "Boa tarde" e "Boa noite" seguida do primeiro nome

### Requirement: Confirmar pagamento
A lista SHALL trazer as cobranças `RENT` não pagas com aviso do inquilino pendente, do aviso mais antigo ao mais novo, com inquilino, unidade, valor, "Informado pelo inquilino" e quando avisou, e a ação Confirmar abrindo o mesmo diálogo de Recebimentos (confirmar recebimento ou "Ainda não recebi").

#### Scenario: Confirmar
- **WHEN** o dono confirma um aviso pela lista
- **THEN** a cobrança é baixada, some da lista e os indicadores se atualizam

### Requirement: Atrasados
A lista SHALL trazer as cobranças `RENT` atrasadas sem aviso pendente, da mais atrasada à menos, com "N dias de atraso", "Venceu em dd/mm" e a ação Cobrar levando ao detalhe com o envio aberto (`?enviar=1`).

#### Scenario: Cobrança com aviso
- **WHEN** uma cobrança atrasada tem aviso pendente
- **THEN** ela aparece só em Confirmar pagamento

### Requirement: Para cobrar
A lista SHALL trazer as cobranças `RENT` a vencer de hoje até 7 dias, sem aviso pendente, ordenadas por vencimento, com "Vence em N dias" ("Vence hoje" no dia) e a ação Enviar cobrança levando ao detalhe com o envio aberto.

#### Scenario: Fora da janela
- **WHEN** uma cobrança vence em 8 dias
- **THEN** ela não aparece em Para cobrar

### Requirement: Fique de olho
A lista SHALL trazer os contratos ativos com reajuste pendente ou nos próximos 30 dias ("Reajuste do {unidade} chega em dd/mm", com o índice do contrato, sem percentual calculado, e a ação Revisar reajuste levando a `/leases/{id}?reajustar=1`) e os contratos ativos com término nos próximos 60 dias ("termina em N dias", com "Ver contrato").

#### Scenario: Contrato terminando
- **WHEN** um contrato ativo termina em 28 dias
- **THEN** aparece "Contrato do {unidade} termina em 28 dias" com a data e a ação Ver contrato

### Requirement: Degradação e erro
Se as cobranças não carregarem, a tela SHALL mostrar a mensagem de erro com "Tentar novamente"; se contratos, inquilinos, imóveis, configuração ou perfil falharem, SHALL mostrar o que for possível, com "—" nos campos ausentes.

#### Scenario: Inquilinos indisponíveis
- **WHEN** a busca de inquilinos falha
- **THEN** as linhas aparecem com o nome "—" e um aviso de dados indisponíveis
