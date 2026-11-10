# receivable-detail Specification

## Purpose
TBD - created by archiving change cobranca-manual. Update Purpose after archive.
## Requirements
### Requirement: Detalhe da cobrança
O frontend SHALL exibir em `/financial/receivables/<id>` o inquilino, a unidade e o imóvel, o mês, a situação, a linha do tempo, os dados da cobrança (valor, vencimento, multa e juros do contrato, onde recebe), o contato do inquilino e o contrato, e SHALL mostrar a página de não encontrado quando a cobrança não existir na organização.

#### Scenario: Cobrança em dia
- **WHEN** a cobrança de R$ 1.850,00 vence em 05/11 com multa de 2% e juros de 1% ao mês
- **THEN** o detalhe mostra "R$ 1.850,00", "05/11/2026" e "2% + 1% ao mês"

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança de R$ 1.550,00 venceu há 8 dias
- **THEN** o detalhe mostra "8 dias de atraso" e a decomposição Aluguel, Multa (2%), Juros e Total hoje

#### Scenario: Onde recebe
- **WHEN** a chave Pix da organização está cadastrada
- **THEN** o detalhe mostra "Chave Pix cadastrada"; sem chave, mostra o aviso com link para `/settings/financial`

#### Scenario: Cobrança paga
- **WHEN** a cobrança está `PAID`
- **THEN** o detalhe mostra a data, a forma de pagamento e o link para o recibo, sem os botões de envio e de acordo

#### Scenario: Inexistente
- **WHEN** o id não existe ou pertence a outra organização
- **THEN** a tela mostra a página de não encontrado

#### Scenario: Dados auxiliares fora do ar
- **WHEN** a busca de eventos, de inquilino ou de imóveis falha
- **THEN** o detalhe mostra o que carregou, com "—" e um aviso nas seções afetadas

#### Scenario: Linha do tempo
- **WHEN** a cobrança tem eventos
- **THEN** o detalhe os mostra em ordem, com data, descrição e "por você" quando o autor é o usuário

### Requirement: Enviar cobrança
O frontend SHALL abrir por `?enviar=1` o envio da cobrança, com a mensagem pronta e editável vinda do modelo do lembrete que se aplica aos dias até o vencimento (contendo nome, mês, unidade, valor, vencimento e o link ou o Pix copia-e-cola, conforme o modelo), indicando qual modelo foi usado, os canais WhatsApp e E-mail, "Copiar mensagem" e "Marcar como enviada". Se os lembretes não puderem ser lidos, SHALL usar o texto fixo anterior, que já muda quando a cobrança está atrasada.

#### Scenario: Mensagem pronta
- **WHEN** o usuário abre o envio de uma cobrança a vencer
- **THEN** a mensagem traz "Oi, Marina!", o mês, a unidade, o valor, o vencimento e o código Pix

#### Scenario: Modelo pelo vencimento
- **WHEN** a cobrança venceu há 4 dias e há lembretes de 0, +3 e +10 dias
- **THEN** a mensagem vem do lembrete de +3 e o diálogo mostra o nome dele

#### Scenario: Lembretes indisponíveis
- **WHEN** a consulta dos lembretes falha
- **THEN** o envio abre com o texto fixo de antes

#### Scenario: Lembrete
- **WHEN** a cobrança está atrasada
- **THEN** a mensagem traz o total atualizado e o evento gravado é `REMINDER`

#### Scenario: Abrir WhatsApp
- **WHEN** o inquilino tem celular válido e o usuário aciona "Abrir WhatsApp"
- **THEN** abre o `wa.me` do celular com a mensagem codificada

#### Scenario: Sem celular
- **WHEN** o inquilino não tem celular válido
- **THEN** o WhatsApp fica desabilitado com a dica de cadastrar o celular

#### Scenario: Editar texto
- **WHEN** o usuário edita a mensagem
- **THEN** o WhatsApp, o e-mail e "Copiar mensagem" usam o texto editado

#### Scenario: Marcar como enviada
- **WHEN** o usuário aciona "Marcar como enviada"
- **THEN** o evento é gravado, a linha do tempo se atualiza e o envio fecha só o parâmetro da URL

### Requirement: Negociar atraso
O frontend SHALL abrir por `?acordo=1`, só para cobrança atrasada, o painel Negociar atraso, com o total de hoje, o novo vencimento, o valor a receber (padrão o total de hoje, editável) e uma observação, e SHALL NOT oferecer Parcelar nem pausar lembretes.

#### Scenario: Salvar acordo
- **WHEN** o usuário informa novo vencimento 12/11 e salva
- **THEN** o pedido leva a nova data e o valor, a cobrança deixa de estar atrasada e a linha do tempo mostra o acordo

#### Scenario: Data inválida
- **WHEN** o novo vencimento é hoje ou anterior
- **THEN** o painel mostra o erro e não envia

#### Scenario: Cobrança em dia
- **WHEN** a cobrança não está atrasada
- **THEN** a ação Negociar atraso não aparece

### Requirement: Recibo numerado
O frontend SHALL exibir o recibo no layout do canvas, com "Nº 0001/2026", o valor, o texto com o valor por extenso, a forma de pagamento, o desconto quando houver, a assinatura do dono e a nota legal, e SHALL oferecer "Baixar PDF" pela impressão do navegador.

#### Scenario: Texto do recibo
- **WHEN** o recibo é de R$ 1.850,00 pago por Pix em 02/11/2026
- **THEN** o texto traz "mil oitocentos e cinquenta reais" e "Pago por Pix em 02/11/2026"

#### Scenario: Valor por extenso
- **WHEN** o valor tem centavos, como R$ 1.585,13
- **THEN** o extenso traz "mil quinhentos e oitenta e cinco reais e treze centavos"

#### Scenario: Desconto
- **WHEN** a cobrança teve desconto de R$ 50,00
- **THEN** o recibo mostra o desconto

#### Scenario: Cobrança não paga
- **WHEN** a cobrança não está paga
- **THEN** a página explica que o recibo só existe depois do pagamento

