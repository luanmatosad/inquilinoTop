# lease-management Specification

## Purpose
TBD - created by archiving change mvp-contratos. Update Purpose after archive.
## Requirements
### Requirement: Criar contrato válido
O sistema SHALL criar contrato apenas com unidade e inquilino ativos da organização do usuário, `start_date`, valor do aluguel e `payment_day` entre 1 e 31, com `end_date` posterior a `start_date` quando informada.

#### Scenario: Criação bem-sucedida
- **WHEN** o usuário envia unidade e inquilino válidos, datas coerentes e aluguel
- **THEN** o sistema cria o contrato com status `ACTIVE` e retorna 201

#### Scenario: Datas incoerentes
- **WHEN** `end_date` é igual ou anterior a `start_date`
- **THEN** o sistema retorna 422 e não cria o contrato

#### Scenario: Unidade ou inquilino inválido
- **WHEN** a unidade ou o inquilino pertence a outra organização ou está excluído
- **THEN** o sistema retorna 404 e não cria o contrato

### Requirement: Um contrato ativo por unidade
O sistema SHALL impedir que uma unidade tenha dois contratos `ACTIVE` com períodos sobrepostos, tratando `end_date` nulo como período aberto.

#### Scenario: Sobreposição
- **WHEN** o usuário cria contrato para unidade que já tem contrato ativo no mesmo período
- **THEN** o sistema retorna 409 `LEASE_OVERLAP`

#### Scenario: Período sequencial
- **WHEN** o novo contrato começa depois do fim do contrato ativo
- **THEN** o sistema cria o contrato

#### Scenario: Requisições simultâneas
- **WHEN** duas criações sobrepostas chegam ao mesmo tempo
- **THEN** apenas uma é aceita e a outra recebe 409

### Requirement: Observações do contrato
O sistema SHALL armazenar `notes` opcional de até 2000 caracteres no contrato.

#### Scenario: Notas salvas
- **WHEN** o usuário envia `notes` ao criar ou atualizar
- **THEN** a resposta inclui o mesmo texto

### Requirement: Gerar cobranças ao criar
O sistema SHALL, quando `generate_payments=true`, gerar as cobranças de aluguel por competência do início até `end_date`, limitado a 12 meses quando o contrato é aberto.

#### Scenario: Contrato com prazo
- **WHEN** o contrato de 6 meses é criado com `generate_payments=true`
- **THEN** existem 6 cobranças `RENT` `PENDING`, uma por competência, no `payment_day`

#### Scenario: Contrato aberto
- **WHEN** o contrato sem `end_date` é criado com `generate_payments=true`
- **THEN** são geradas 12 cobranças

#### Scenario: Idempotência
- **WHEN** a geração é solicitada de novo para as mesmas competências
- **THEN** nenhuma cobrança duplicada é criada

### Requirement: Encerrar contrato
O sistema SHALL encerrar contrato `ACTIVE` mudando o status para `ENDED`, aceitando opcionalmente a data de saída (`end_date`) e o motivo (`reason`), e desativando as cobranças futuras `PENDING` sem cobrança emitida com vencimento depois da data de saída, preservando as pagas e as vencidas até essa data. Sem corpo, a data de saída é hoje e não há motivo.

#### Scenario: Encerramento
- **WHEN** o usuário encerra um contrato com cobranças futuras pendentes
- **THEN** o contrato fica `ENDED` e essas cobranças deixam de aparecer em contas a receber

#### Scenario: Data de saída informada
- **WHEN** o usuário encerra com `end_date` 2026-11-30
- **THEN** o contrato fica `ENDED` com fim em 2026-11-30 e só as cobranças pendentes com vencimento depois dessa data são desativadas

#### Scenario: Motivo
- **WHEN** o usuário envia `reason` `TERM_END`, `TENANT_REQUEST`, `NONPAYMENT`, `OWNER_REQUEST` ou `OTHER`
- **THEN** o motivo é gravado no contrato e devolvido na resposta

#### Scenario: Motivo inválido
- **WHEN** `reason` não está na lista
- **THEN** o sistema retorna 400 e não encerra o contrato

#### Scenario: Data anterior ao início
- **WHEN** `end_date` é anterior a `start_date`
- **THEN** o sistema retorna 422 e o contrato continua `ACTIVE`

#### Scenario: Saída nunca estende o prazo
- **WHEN** o contrato termina em 2027-03-10 e o usuário informa saída em 2027-06-01
- **THEN** o fim permanece 2027-03-10

#### Scenario: Cobrança já emitida
- **WHEN** uma cobrança futura pendente tem `charge_id`
- **THEN** ela é mantida e a resposta sinaliza que precisa de decisão manual

#### Scenario: Contrato já encerrado
- **WHEN** o usuário tenta encerrar contrato `ENDED`
- **THEN** o sistema retorna 409 `LEASE_NOT_ACTIVE`

### Requirement: Renovar e reajustar
O sistema SHALL renovar contrato `ACTIVE` com nova data final e, opcionalmente, novo aluguel e dia de pagamento, e reajustar o aluguel com percentual entre 0 (exclusivo) e 1 (inclusivo), registrando histórico e aplicando o novo valor às cobranças de aluguel futuras pendentes sem cobrança emitida.

#### Scenario: Renovação sem sobreposição
- **WHEN** o usuário renova com `new_end_date` posterior ao atual
- **THEN** o contrato é atualizado e permanece `ACTIVE`

#### Scenario: Renovação inválida
- **WHEN** `new_end_date` é anterior ao `end_date` atual
- **THEN** o sistema retorna 422

#### Scenario: Reajuste
- **WHEN** o usuário aplica reajuste de 5% (0,05) a um contrato ativo
- **THEN** o aluguel aumenta 5% e o histórico registra o reajuste

#### Scenario: Cobranças futuras recebem o novo valor
- **WHEN** o contrato tem aluguel de R$ 1.000,00, doze cobranças `RENT` pendentes e o usuário reajusta 10% com vigência a partir do vencimento da quinta
- **THEN** as cobranças da quinta em diante passam a R$ 1.100,00 e as quatro primeiras continuam em R$ 1.000,00

#### Scenario: Cobranças que não mudam
- **WHEN** o reajuste é aplicado
- **THEN** não mudam as cobranças `PAID`, as `EXPENSE` (IPTU), as com vencimento antes da vigência e as de outros contratos

#### Scenario: Cobrança já emitida
- **WHEN** uma cobrança futura pendente tem `charge_id`
- **THEN** o valor dela não muda e a resposta conta essa cobrança como "precisa de revisão"

#### Scenario: Resposta informa o efeito
- **WHEN** o reajuste atualiza 7 cobranças e 1 precisa de revisão
- **THEN** a resposta traz `payments_updated` 7 e `payments_need_review` 1

#### Scenario: Falha ao atualizar as cobranças
- **WHEN** a atualização das cobranças falha depois de o aluguel do contrato ter sido reajustado
- **THEN** o reajuste do contrato é mantido e a resposta traz `payments_error`

### Requirement: Isolamento e exclusão lógica
O sistema SHALL filtrar contratos por `organization_id` e excluir apenas com `is_active=false`.

#### Scenario: Contrato de outra organização
- **WHEN** o usuário acessa contrato de outra organização
- **THEN** o sistema retorna 404

### Requirement: Telas de contrato no frontend
O frontend SHALL oferecer em `/leases/**` lista, criação, edição, detalhe e as ações de encerrar e reajustar, com criação, edição e reajuste em painel lateral e encerramento em modal, todos controlados por parâmetros de URL, com confirmação nas ações destrutivas.

#### Scenario: Erro de sobreposição na tela
- **WHEN** o backend retorna `LEASE_OVERLAP`
- **THEN** o formulário explica que a unidade já tem contrato ativo no período

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/contracts`
- **THEN** é redirecionado permanentemente para `/leases`

### Requirement: Índice e mês de reajuste do contrato
O sistema SHALL guardar no contrato o índice de reajuste (`IGP-M` ou `IPCA`, opcional) e o mês de reajuste (1 a 12), usando como mês padrão o de `start_date` quando não informado.

#### Scenario: Valores informados
- **WHEN** o usuário cria um contrato com `adjustment_index` `IGP-M` e `adjustment_month` 3
- **THEN** a resposta traz os dois valores

#### Scenario: Mês padrão
- **WHEN** o contrato começa em 10/03/2025 e `adjustment_month` não é enviado
- **THEN** `adjustment_month` é 3

#### Scenario: Valores inválidos
- **WHEN** `adjustment_month` é 13 ou `adjustment_index` é "XYZ"
- **THEN** o sistema retorna 400

#### Scenario: Contratos existentes
- **WHEN** a migration roda
- **THEN** cada contrato recebe `adjustment_month` igual ao mês de `start_date` e `adjustment_index` nulo

### Requirement: Próximo reajuste
O sistema SHALL devolver em cada contrato o campo `next_readjustment` (data, dia 1) e SHALL devolver nulo quando o contrato não tem mês de reajuste. Sem reajuste aplicado, é o primeiro mês de reajuste pelo menos 12 meses depois do início. Com reajuste aplicado depois do início, é o ciclo do mês de reajuste mais próximo da data aplicada (empate vale o ciclo anterior) mais 12 meses, de modo que um reajuste feito com atraso ou adiantado não desloca o aniversário do contrato.

#### Scenario: Depois do início
- **WHEN** o contrato começa em 03/2025, tem mês de reajuste 3 e nenhum reajuste aplicado
- **THEN** `next_readjustment` é 2026-03-01

#### Scenario: Depois de um reajuste
- **WHEN** o último reajuste foi aplicado em 03/2026
- **THEN** `next_readjustment` é 2027-03-01

#### Scenario: Reajuste aplicado com atraso
- **WHEN** o mês de reajuste é 3 e o último reajuste foi aplicado em 04/2026
- **THEN** `next_readjustment` é 2027-03-01

#### Scenario: Reajuste aplicado adiantado
- **WHEN** o mês de reajuste é 3 e o último reajuste foi aplicado em 02/2026
- **THEN** `next_readjustment` é 2027-03-01

#### Scenario: Reajuste aplicado muito depois
- **WHEN** o mês de reajuste é 3 e o último reajuste foi aplicado em 10/2026
- **THEN** `next_readjustment` é 2028-03-01

#### Scenario: Mês diferente do início
- **WHEN** o contrato começou em 08/2024, tem mês de reajuste 11 e nenhum reajuste aplicado
- **THEN** `next_readjustment` é 2025-11-01

#### Scenario: Mês de reajuste logo antes do aniversário do início
- **WHEN** o contrato começou em 03/2025, tem mês de reajuste 2 e nenhum reajuste aplicado
- **THEN** `next_readjustment` é 2027-02-01, porque o primeiro reajuste só vale depois de 12 meses

#### Scenario: Sem mês de reajuste
- **WHEN** o contrato não tem `adjustment_month`
- **THEN** `next_readjustment` é nulo

#### Scenario: Na listagem
- **WHEN** o usuário lista contratos
- **THEN** cada um traz `next_readjustment` sem uma consulta extra por contrato

### Requirement: Lista de contratos com indicadores
A lista de `/leases` SHALL mostrar os indicadores Ativos (quantidade e soma do aluguel por mês), Vencendo em 30 dias, Reajuste em 90 dias e Encerrados, e uma tabela com Unidade (e imóvel), Inquilino, Início, Fim ("Sem fim" quando aberto), Aluguel, Próx. reajuste (MM/AAAA) e Situação, com busca por inquilino ou unidade, filtro por situação e contagem no rodapé.

#### Scenario: Linha da tabela
- **WHEN** existe o contrato da Marina Souza no Apartamento 302 do Ed. Aurora, de 10/03/2025 a 10/03/2028, R$ 1.850,00, com próximo reajuste em 03/2027
- **THEN** a linha mostra "Apartamento 302", "Ed. Aurora", "Marina Souza", "10/03/2025", "10/03/2028", "R$ 1.850,00", "03/2027" e "Ativo"

#### Scenario: Contrato sem fim
- **WHEN** o contrato não tem `end_date`
- **THEN** a coluna Fim mostra "Sem fim"

#### Scenario: Indicadores
- **WHEN** há 5 contratos ativos que somam R$ 8.300,00
- **THEN** o indicador Ativos mostra 5 e "R$ 8.300,00 por mês"

#### Scenario: Vencendo em 30 dias
- **WHEN** um contrato ativo termina daqui a 20 dias
- **THEN** o indicador Vencendo em 30 dias conta esse contrato

#### Scenario: Reajuste em 90 dias
- **WHEN** um contrato ativo tem `next_readjustment` daqui a 60 dias, ou no mês corrente
- **THEN** o indicador Reajuste em 90 dias conta esse contrato e mostra "Unidade · Imóvel" dele

#### Scenario: Reajuste pendente
- **WHEN** o `next_readjustment` de um contrato ativo é de um mês anterior ao corrente
- **THEN** a coluna Próx. reajuste marca "pendente" e o contrato não entra no indicador de 90 dias

#### Scenario: Busca e filtro
- **WHEN** o usuário busca "marina" ou filtra por Encerrados
- **THEN** só os contratos que casam aparecem e a URL guarda `?q=` e `?situacao=`

#### Scenario: Estados da lista
- **WHEN** a lista está vazia, o filtro não encontra nada ou o carregamento falha
- **THEN** a tela mostra respectivamente o convite para criar o primeiro contrato, "Nenhum contrato encontrado." e a mensagem de erro com nova tentativa

#### Scenario: Dados auxiliares fora do ar
- **WHEN** a busca de inquilinos ou de imóveis falha
- **THEN** a lista aparece com "—" nas colunas afetadas e um aviso

#### Scenario: Celular
- **WHEN** a largura da tela é menor que 768px
- **THEN** a tabela é substituída por cards

### Requirement: Criação de contrato em painel
O frontend SHALL criar contrato em painel lateral aberto por `?novo=1`, com Unidade, Inquilino, Valor do aluguel, Dia de vencimento, Início, Fim (opcional), Índice de reajuste, Reajustar em, Multa e juros, IPTU reembolsável, geração das cobranças dos próximos 12 meses e Observações, e SHALL aceitar `?inquilino=<id>` e `?unidade=<id>` para pré-selecionar.

#### Scenario: Abrir pré-selecionado
- **WHEN** o usuário abre `/leases?novo=1&inquilino=t1`
- **THEN** o painel abre com o inquilino t1 escolhido

#### Scenario: Aluguel sugerido pela unidade
- **WHEN** o usuário escolhe uma unidade com aluguel de referência R$ 1.850,00 e o campo de aluguel está vazio
- **THEN** o aluguel é preenchido com R$ 1.850,00 e a dica "Sugerido pela unidade." aparece

#### Scenario: Aluguel já digitado
- **WHEN** o usuário já digitou um aluguel e escolhe outra unidade
- **THEN** o valor digitado é mantido

#### Scenario: Mês de reajuste padrão
- **WHEN** o usuário informa início em 10/03/2025
- **THEN** "Reajustar em" mostra março, e o usuário pode trocar

#### Scenario: Multa e juros padrão
- **WHEN** o painel abre
- **THEN** mostra "Padrão: multa de 2% e juros de 1% ao mês" com "Alterar neste contrato", e os campos só aparecem ao acionar o link

#### Scenario: Gerar cobranças
- **WHEN** o usuário mantém a geração ligada e cria o contrato
- **THEN** o pedido leva `generate_payments` verdadeiro e o aviso de sucesso informa quantas cobranças foram geradas

#### Scenario: Sobreposição
- **WHEN** o backend retorna `LEASE_OVERLAP`
- **THEN** o painel permanece aberto com a mensagem de que a unidade já tem contrato ativo no período

#### Scenario: Salvar
- **WHEN** os dados são válidos
- **THEN** o contrato é criado, o painel fecha e a lista mostra o novo contrato

### Requirement: Multa e juros em porcentagem ao mês
O frontend SHALL mostrar e receber os juros em porcentagem ao mês e SHALL convertê-los para o percentual diário que o backend guarda, dividindo por 30 ao enviar e multiplicando por 30 ao exibir.

#### Scenario: Envio
- **WHEN** o usuário informa juros de 1% ao mês
- **THEN** o corpo enviado leva `daily_interest_percent` 0,033333

#### Scenario: Exibição
- **WHEN** o contrato tem `daily_interest_percent` 0,033333
- **THEN** a tela mostra "1,00% ao mês"

### Requirement: Detalhe do contrato
O detalhe de `/leases/<id>` SHALL mostrar o cabeçalho (Unidade · Imóvel, Inquilino e "desde" a data de início, situação, Editar e Encerrar contrato), as cobranças de aluguel mais recentes, o histórico de reajustes, os termos, as partes e o contrato assinado, e SHALL NOT oferecer abas nem "Criar aditivo".

#### Scenario: Cobranças
- **WHEN** o contrato tem 20 cobranças de aluguel
- **THEN** a tabela mostra as 4 de vencimento mais recente, com Mês, Vence em, Valor e Situação (Pago, Atrasado ou Previsto), e o texto "Mostrando as 4 mais recentes de 20."

#### Scenario: Histórico de reajustes
- **WHEN** o contrato começou com R$ 1.760,00 e teve um reajuste de 5,1% em 03/2026 para R$ 1.850,00
- **THEN** o histórico mostra a linha "03/2026 · IGP-M · 5,1% · R$ 1.850,00" e a linha "03/2025 · Início · — · R$ 1.760,00"

#### Scenario: Sem reajustes
- **WHEN** o contrato nunca foi reajustado
- **THEN** o histórico mostra só a linha de início com o aluguel atual

#### Scenario: Termos
- **WHEN** o contrato tem aluguel de R$ 1.850,00, vencimento no dia 5, período 10/03/2025 a 10/03/2028, índice IGP-M, multa 2% e juros de 1% ao mês, sem IPTU
- **THEN** a seção Termos mostra "R$ 1.850,00", "todo dia 5", "10/03/2025 a 10/03/2028", "03/2027 · IGP-M", "2% + 1% ao mês" e "não reembolsável"

#### Scenario: Contrato encerrado
- **WHEN** o contrato está `ENDED`
- **THEN** os botões Encerrar e Reajustar não aparecem e o selo mostra "Encerrado", com a data e o motivo da saída

#### Scenario: Contrato inexistente
- **WHEN** o id não existe ou pertence a outra organização
- **THEN** a tela mostra a página de não encontrado

#### Scenario: Cobranças ou reajustes fora do ar
- **WHEN** a busca de cobranças ou a de reajustes falha
- **THEN** o resto do detalhe aparece e a seção afetada avisa que está indisponível

### Requirement: Encerramento em modal com data e motivo
O frontend SHALL encerrar contrato em modal aberto por `?encerrar=1`, pedindo a data de saída e o motivo, e SHALL explicar o efeito: as cobranças depois da data são canceladas, o que já está pendente continua a receber, a unidade passa a ficar vaga e o histórico é mantido.

#### Scenario: Explicação
- **WHEN** o modal abre com data de saída 30/11/2026
- **THEN** o texto diz que as cobranças depois de 30/11 são canceladas e que a unidade passa a ficar vaga

#### Scenario: Confirmar
- **WHEN** o usuário informa data e motivo e confirma
- **THEN** o pedido leva `end_date` e `reason`, o modal fecha e o aviso informa quantas cobranças foram canceladas

#### Scenario: Cobranças para revisão
- **WHEN** a resposta traz `payments_need_review` maior que zero
- **THEN** o aviso informa que há cobranças com cobrança emitida que precisam de decisão manual

#### Scenario: Data no passado
- **WHEN** a data de saída é anterior a hoje
- **THEN** o modal avisa que cobranças com vencimento depois dela também serão canceladas

#### Scenario: Voltar
- **WHEN** o usuário aciona Voltar
- **THEN** o modal fecha sem encerrar o contrato

### Requirement: Reajuste em painel com prévia
O frontend SHALL reajustar o aluguel em painel aberto por `?reajustar=1`, com o contrato, o aniversário, o aluguel atual, o índice, o percentual do período, a data de vigência e a prévia do novo aluguel com o valor do aumento, e SHALL oferecer avisar o inquilino pelo WhatsApp.

#### Scenario: Prévia
- **WHEN** o aluguel atual é R$ 1.550,00 e o usuário informa 4,5%
- **THEN** a prévia mostra "Novo aluguel: R$ 1.619,75 (aumento de R$ 69,75)"

#### Scenario: Percentual inválido
- **WHEN** o percentual é zero, negativo ou maior que 100
- **THEN** o painel mostra o erro no campo e não chama o backend

#### Scenario: Aplicar
- **WHEN** o usuário confirma
- **THEN** o pedido leva o percentual como fração, o índice e a data de vigência, o painel fecha e o aviso informa quantas cobranças futuras foram atualizadas

#### Scenario: Aviso por WhatsApp
- **WHEN** o usuário liga "Avisar o inquilino pelo WhatsApp" e o reajuste é aplicado
- **THEN** abre o WhatsApp com uma mensagem pronta contendo o novo aluguel e a data de vigência

#### Scenario: Sem celular
- **WHEN** o inquilino não tem celular válido
- **THEN** a opção de WhatsApp não aparece

### Requirement: Edição preserva os campos não exibidos
O frontend SHALL editar o contrato em painel aberto por `?editar=1`, mostrando unidade, inquilino e início apenas como texto, e SHALL devolver ao backend os valores atuais da caução, do valor anual e do ano do IPTU e do status, que a tela não edita.

#### Scenario: Caução preservada
- **WHEN** o contrato tem caução de R$ 3.700,00 e o usuário altera só o aluguel
- **THEN** o corpo enviado contém a caução original

#### Scenario: Campos fixos
- **WHEN** o painel de edição abre
- **THEN** a unidade, o inquilino e o início aparecem como texto, sem campos de edição

### Requirement: Contrato assinado anexado
O frontend SHALL permitir anexar ao contrato o PDF assinado (até 10 MB), listar os anexos e baixá-los, usando o módulo de documentos com `entity_type` `lease`.

#### Scenario: Anexar
- **WHEN** o usuário escolhe um PDF de até 10 MB
- **THEN** o arquivo é enviado e aparece na lista de documentos do contrato

#### Scenario: Arquivo grande ou de outro tipo
- **WHEN** o arquivo passa de 10 MB ou não é PDF
- **THEN** a tela recusa o envio com uma mensagem e não chama o backend

#### Scenario: Baixar
- **WHEN** o usuário aciona o download de um anexo
- **THEN** o arquivo é entregue sem expor o token de sessão ao navegador

