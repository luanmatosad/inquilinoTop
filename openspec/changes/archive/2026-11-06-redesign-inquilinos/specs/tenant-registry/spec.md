## MODIFIED Requirements

### Requirement: Telas de inquilinos em rota única
O frontend SHALL oferecer lista, criação, edição, exclusão e detalhe de inquilinos somente em `/tenants/**`, com máscara para CPF/CNPJ e telefone.

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/tenants`
- **THEN** é redirecionado permanentemente para `/tenants`

#### Scenario: Erro de duplicidade na tela
- **WHEN** o backend retorna `DUPLICATE_DOCUMENT`
- **THEN** o formulário exibe a mensagem junto ao campo de documento

## ADDED Requirements

### Requirement: Lista de inquilinos em tabela
A lista de `/tenants` SHALL mostrar os inquilinos em tabela com Inquilino (nome, e-mail e celular), Documento mascarado, Imóvel e unidade e Cobrança do mês, SHALL permitir buscar por nome, e-mail ou documento e filtrar por situação de cobrança, SHALL oferecer os botões Importar (para `/import`) e Cadastrar inquilino, e SHALL mostrar a contagem de inquilinos no rodapé.

#### Scenario: Linha da tabela
- **WHEN** existe o inquilino "Marina Souza" com contrato ativo no "Ap 302" do "Ed. Aurora" e cobrança do mês paga
- **THEN** a linha mostra o nome, "marina@email.com · (11) 98888-1111", "123.456.***-09", "Ap 302 · Ed. Aurora" e "Pago"

#### Scenario: Inquilino sem contrato
- **WHEN** o inquilino não tem contrato ativo
- **THEN** a coluna de imóvel mostra "Sem contrato" e a de cobrança mostra "—"

#### Scenario: Busca
- **WHEN** o usuário busca "marina" ou os dígitos do CPF
- **THEN** só os inquilinos cujo nome, e-mail ou documento contêm o termo aparecem

#### Scenario: Filtro por cobrança
- **WHEN** o usuário filtra por Atrasado
- **THEN** só inquilinos com situação "Atrasado" aparecem e a URL guarda `?cobranca=`

#### Scenario: Importar
- **WHEN** o usuário clica em Importar
- **THEN** vai para `/import`

#### Scenario: Estados da lista
- **WHEN** a lista está vazia, o filtro não encontra ninguém ou o carregamento falha
- **THEN** a tela mostra respectivamente o convite para cadastrar o primeiro inquilino, "Nenhum inquilino encontrado." e a mensagem de erro com nova tentativa

#### Scenario: Celular
- **WHEN** a largura da tela é menor que 768px
- **THEN** a tabela é substituída por cards com os mesmos dados

### Requirement: Cadastro rápido em painel lateral
O frontend SHALL cadastrar inquilino em painel lateral aberto por `?novo=1`, com Tipo (Pessoa física ou Empresa), Nome completo (ou Razão social), CPF (ou CNPJ), E-mail, Celular (WhatsApp) e Observações, SHALL validar o documento conforme o tipo e SHALL NOT pedir endereço no cadastro.

#### Scenario: Abrir e fechar
- **WHEN** o usuário clica em "Cadastrar inquilino"
- **THEN** a URL ganha `?novo=1`, o painel abre, e o botão voltar do navegador o fecha

#### Scenario: Salvar
- **WHEN** o usuário informa nome e documento válidos e confirma
- **THEN** o inquilino é criado, o painel fecha e a lista mostra o novo inquilino

#### Scenario: Troca para Empresa
- **WHEN** o usuário escolhe Empresa
- **THEN** os rótulos viram "Razão social" e "CNPJ" e o documento é validado como CNPJ

#### Scenario: Documento inválido
- **WHEN** o usuário informa um CPF com dígito verificador incorreto
- **THEN** o painel permanece aberto com a mensagem de erro no campo

#### Scenario: Sem fiador nem endereço
- **WHEN** o painel de cadastro é exibido
- **THEN** não há campos de endereço nem de fiador

### Requirement: Edição que preserva o endereço
O frontend SHALL editar o inquilino no mesmo painel, aberto por `?editar=1` no detalhe, e SHALL preservar o endereço já gravado (CEP, logradouro, cidade e UF) enviando os valores atuais mesmo sem exibi-los.

#### Scenario: Valores atuais
- **WHEN** o usuário abre a edição de "Marina Souza"
- **THEN** o painel traz o tipo, nome, CPF, e-mail, celular e observações atuais

#### Scenario: Endereço preservado
- **WHEN** o inquilino tem CEP, logradouro, cidade e UF gravados e o usuário altera só o e-mail
- **THEN** o corpo enviado ao backend contém os valores antigos de endereço e o endereço não é apagado

#### Scenario: Salvar
- **WHEN** o usuário confirma a edição
- **THEN** o painel fecha e o detalhe mostra os dados atualizados

### Requirement: Exclusão no painel de edição
O frontend SHALL oferecer "Excluir inquilino" no rodapé do painel de edição, com confirmação, e SHALL explicar a recusa quando o inquilino tem contrato ativo.

#### Scenario: Excluir sem contrato ativo
- **WHEN** o usuário confirma a exclusão de um inquilino sem contrato ativo
- **THEN** o inquilino é desativado e o usuário volta para `/tenants`

#### Scenario: Contrato ativo
- **WHEN** o backend recusa a exclusão por contrato ativo
- **THEN** a tela mostra "Este inquilino tem contrato ativo. Encerre o contrato antes de excluir." e o inquilino permanece

### Requirement: Detalhe do inquilino
O detalhe de `/tenants/<id>` SHALL mostrar o cabeçalho (breadcrumb, nome, e-mail e celular, situação de cobrança, Editar e Abrir WhatsApp), o cartão Cobrança do mês, o cartão Contrato atual, Observações e Contato, e SHALL NOT listar o histórico de contratos nem exibir abas.

#### Scenario: Com contrato
- **WHEN** o inquilino tem contrato ativo de R$ 1.850,00, vencimento no dia 5, no Apartamento 302 do Ed. Aurora
- **THEN** o cartão Contrato atual mostra a unidade e o imóvel, o aluguel e "Vence todo dia 5", com o botão "Ver contrato" levando a `/leases/<id>`

#### Scenario: Cobrança do mês
- **WHEN** existe o pagamento de aluguel de novembro, R$ 1.850,00, vencendo em 05/11/2026
- **THEN** o cartão mostra "Novembro · R$ 1.850,00", "Vence em 05/11/2026" e a situação, com o botão "Ver cobrança"

#### Scenario: Sem contrato
- **WHEN** o inquilino não tem contrato ativo
- **THEN** o cabeçalho mostra o selo "Sem contrato" e o botão "Criar contrato", e o cartão informa "Para gerar cobranças, ligue este inquilino a uma unidade."

#### Scenario: Observações
- **WHEN** o inquilino tem observações
- **THEN** elas aparecem em um cartão próprio; sem observações, o cartão não aparece

#### Scenario: Inquilino inexistente
- **WHEN** o id não existe ou pertence a outra organização
- **THEN** a tela mostra a página de não encontrado

### Requirement: Documento mascarado fora da edição
O frontend SHALL exibir CPF e CNPJ de forma parcial (`123.456.***-09`, `12.345.***/0001-90`) na lista e no detalhe, aplicando a máscara no servidor, e SHALL entregar o documento completo ao navegador somente quando o painel de edição estiver aberto.

#### Scenario: Lista e detalhe
- **WHEN** a lista ou o detalhe são renderizados
- **THEN** o documento aparece mascarado e o documento completo não está presente no HTML nem nas props de componentes cliente

#### Scenario: Edição
- **WHEN** o painel de edição está aberto
- **THEN** o campo de documento traz o valor completo, com a máscara de digitação

### Requirement: Abrir WhatsApp
O frontend SHALL oferecer "Abrir WhatsApp" quando o celular for válido, abrindo `https://wa.me/55<DDD+número>` em nova aba com `rel="noopener noreferrer"`.

#### Scenario: Celular válido
- **WHEN** o celular é "(11) 98888-1111"
- **THEN** o botão aponta para `https://wa.me/5511988881111`

#### Scenario: Celular já com 55
- **WHEN** o celular salvo é "5511988881111"
- **THEN** o link não duplica o prefixo

#### Scenario: Celular ausente ou inválido
- **WHEN** o inquilino não tem celular ou ele tem menos de 10 dígitos
- **THEN** o botão não aparece
