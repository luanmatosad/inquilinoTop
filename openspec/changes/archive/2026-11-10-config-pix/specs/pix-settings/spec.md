## ADDED Requirements

### Requirement: Chave Pix da organização
O sistema SHALL guardar por organização o tipo da chave (`CPF`, `CNPJ`, `EMAIL`, `PHONE` ou `RANDOM`), a chave, o nome do recebedor (até 25 caracteres) e a cidade (até 15), expondo `GET /settings/pix` (`org:read`) e `PUT /settings/pix` (`org:update`). A chave SHALL ser validada e normalizada por tipo (CPF e CNPJ com dígito verificador e só dígitos, e-mail em minúsculas, telefone como `+55` mais dígitos, chave aleatória como UUID em minúsculas); chave inválida SHALL dar 400 `INVALID_PIX_KEY` e nome ou cidade acima do limite, 400 `INVALID_PIX`.

#### Scenario: CPF com pontuação
- **WHEN** o dono grava o tipo CPF com a chave "123.456.789-09" (válido)
- **THEN** a chave fica gravada como "12345678909"

#### Scenario: CPF inválido
- **WHEN** o dono grava um CPF com dígito verificador errado
- **THEN** a resposta é 400 `INVALID_PIX_KEY` e nada muda

#### Scenario: Telefone
- **WHEN** o dono grava o tipo PHONE com "(92) 99999-0000"
- **THEN** a chave fica "+5592999990000"

#### Scenario: Nome longo
- **WHEN** o nome do recebedor tem 30 caracteres
- **THEN** a resposta é 400 `INVALID_PIX` e nada muda

#### Scenario: Sem permissão
- **WHEN** um papel sem `org:update` tenta gravar
- **THEN** a resposta é 403

### Requirement: Receber em outra conta por unidade
O sistema SHALL permitir uma conta Pix ativa por unidade (`PUT /settings/pix/units/{unitId}` e `DELETE /settings/pix/units/{unitId}`, `org:update`), exigindo `confirmed: true` no corpo (400 `CONFIRMATION_REQUIRED` sem ele), validando a chave como na organização, aceitando só unidades da organização (404 caso contrário) e gravando quem confirmou e quando. Trocar a conta SHALL desativar a anterior e criar outra; remover SHALL só desativar, mantendo o histórico.

#### Scenario: Sem confirmação
- **WHEN** o dono grava a conta da unidade sem `confirmed`
- **THEN** a resposta é 400 `CONFIRMATION_REQUIRED` e nada muda

#### Scenario: Trocar a conta da unidade
- **WHEN** a unidade já tem uma conta e o dono grava outra confirmada
- **THEN** a anterior fica desativada, a nova vale e a consulta traz só a nova

#### Scenario: Usar a chave padrão
- **WHEN** o dono remove a conta da unidade
- **THEN** a unidade volta a usar a chave da organização e o histórico é mantido

#### Scenario: Unidade de outra organização
- **WHEN** o dono tenta gravar a conta de uma unidade de outra organização
- **THEN** a resposta é 404

### Requirement: Resolução da chave na cobrança
O Pix de uma cobrança SHALL usar, nesta ordem, a conta ativa da unidade do contrato, o Pix da organização e a chave antiga de `financial_config`, usando o nome e a cidade da conta escolhida e, se vazios, o nome do perfil e a cidade do imóvel. Sem nenhuma chave SHALL dar 422 `PIX_KEY_NOT_CONFIGURED`.

#### Scenario: Unidade com outra conta
- **WHEN** a unidade tem conta própria e a organização outra
- **THEN** o código Pix da cobrança leva a chave e o nome da unidade

#### Scenario: Só a chave antiga
- **WHEN** a organização nunca usou a tela nova e tem `financial_config.pix_key`
- **THEN** o código Pix continua sendo gerado com essa chave

### Requirement: Tela de Recebimento (Pix)
O frontend SHALL oferecer `/settings/pix` com a chave padrão (tipo, chave, nome, cidade) e a tabela "Receber em outra conta por imóvel" (rótulo "Unidade · Imóvel", chave mascarada, Situação "Chave padrão" ou "Outra chave"), com painel de edição que traz o aviso de que os pagamentos vão para outra conta e o checkbox de confirmação obrigatório, e a ação "Usar chave padrão". `/settings/financial` SHALL redirecionar para `/settings/pix`.

#### Scenario: Sem confirmar
- **WHEN** o dono tenta salvar a conta da unidade sem marcar a confirmação
- **THEN** o botão fica desabilitado e nada é enviado

#### Scenario: Chave antiga sugerida
- **WHEN** a organização só tem a chave antiga
- **THEN** a tela abre com ela preenchida e o aviso "Salve para confirmar"

#### Scenario: Endereço antigo
- **WHEN** o dono abre `/settings/financial`
- **THEN** é levado a `/settings/pix`
