## ADDED Requirements

### Requirement: Shell autenticado
O frontend SHALL renderizar, para usuário com sessão, um shell com sidebar fixa no desktop e topbar, e SHALL renderizar rotas públicas (`/login`, `/auth/callback`) sem shell. O frontend SHALL NOT oferecer modo visitante: sem sessão, não há shell.

#### Scenario: Desktop autenticado
- **WHEN** um usuário com sessão abre `/` em tela larga
- **THEN** a sidebar fica visível e a topbar aparece acima do conteúdo

#### Scenario: Rota pública
- **WHEN** qualquer usuário abre `/login`
- **THEN** o conteúdo aparece sem sidebar nem topbar

#### Scenario: Sem sessão
- **WHEN** um usuário sem sessão abre uma rota protegida
- **THEN** o middleware redireciona para `/login` e nenhum cabeçalho ou sidebar é renderizado

### Requirement: Navegação conforme o canvas
O frontend SHALL expor, em uma única definição (`nav.ts`), a navegação da sidebar do canvas em três grupos: Gestão (Hoje, Imóveis, Inquilinos, Contratos), Financeiro (Recebimentos, Despesas, Relatórios) e Administrativo (Integrações, Configurações), nessa ordem, e SHALL marcar como ativo o item cuja rota corresponde ao caminho atual.

#### Scenario: Item ativo
- **WHEN** o caminho atual é `/properties/abc`
- **THEN** o item Imóveis aparece como ativo e os demais não

#### Scenario: Itens fora do menu
- **WHEN** a sidebar e a paleta de comandos são renderizadas
- **THEN** nenhum item Laudos, Importar, Documentos ou Fechamento é listado, e `/inspections` e `/import` continuam acessíveis por URL

#### Scenario: Rota ainda sem tela
- **WHEN** o usuário abre Relatórios ou Integrações
- **THEN** a página mostra um aviso de "em breve" sem chamar a API

### Requirement: Navegação mobile
O frontend SHALL, em telas estreitas, substituir a sidebar fixa por uma barra inferior com cinco abas (Hoje, Imóveis, Inquilinos, Receber e Mais), e a aba "Mais" SHALL listar Despesas, Relatórios, Contratos, Integrações, Configurações, os dados do usuário e a ação Sair.

#### Scenario: Celular
- **WHEN** um usuário com sessão abre `/` em tela de 390px
- **THEN** a sidebar fixa não aparece e a barra inferior mostra as cinco abas, com Hoje ativa

#### Scenario: Abrir Mais
- **WHEN** o usuário toca em "Mais"
- **THEN** vê Despesas, Relatórios, Contratos, Integrações e Configurações, mais o usuário e Sair

### Requirement: Paleta de comandos
O frontend SHALL abrir uma paleta de comandos com ⌘K ou Ctrl+K que lista os destinos de navegação e navega ao selecionar um.

#### Scenario: Abrir e navegar
- **WHEN** o usuário pressiona ⌘K, digita "inquil" e confirma o primeiro resultado
- **THEN** o app navega para `/tenants` e a paleta fecha

#### Scenario: Sem Laudos
- **WHEN** o usuário busca "laudo" na paleta
- **THEN** nenhum resultado de Laudos aparece
