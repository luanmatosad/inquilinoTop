# settings-navigation Specification

## Purpose
TBD - created by archiving change config-base. Update Purpose after archive.
## Requirements
### Requirement: Layout de Configurações
O frontend SHALL mostrar as páginas de `/settings/*` com o menu lateral de seções em telas médias e maiores, e no celular só o conteúdo com o voltar para a lista; `/settings` SHALL ser a lista de seções. O item Configurações do menu principal SHALL levar a `/settings/profile`.

#### Scenario: Desktop
- **WHEN** o dono abre `/settings/security` em tela larga
- **THEN** vê o menu lateral com Segurança destacada

#### Scenario: Celular
- **WHEN** o dono abre `/settings` no celular
- **THEN** vê a lista de seções e, ao escolher uma, o conteúdo com o voltar para Configurações

### Requirement: Seções ainda sem tela
O menu SHALL listar todas as seções do canvas; as sem tela (Personalização, Plano e cobrança, Mensagens e cobrança, Regras financeiras, Categorias de despesa, Privacidade e dados) SHALL aparecer com o selo "Em breve" e sem link, e Recebimento (Pix) SHALL levar a `/settings/financial`.

#### Scenario: Em breve
- **WHEN** o dono olha o menu
- **THEN** Regras financeiras aparece com "Em breve" e não é clicável

### Requirement: Perfil e Equipe mantêm o comportamento
Perfil e Equipe SHALL continuar lendo e gravando os mesmos dados, com o visual do canvas, sob o novo layout; o e-mail aparece somente leitura e os dados de CPF/CNPJ e endereço continuam editáveis.

#### Scenario: Salvar o perfil
- **WHEN** o dono altera o telefone e salva
- **THEN** o perfil é atualizado como antes

