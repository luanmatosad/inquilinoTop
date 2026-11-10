## MODIFIED Requirements

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
