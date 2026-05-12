# language: pt
# frontend/e2e-bdd/features/inquilinos.feature
Funcionalidade: Gestão de Inquilinos

  Contexto:
    Dado que estou na página de inquilinos

  @smoke
  Cenário: Listar inquilinos existentes
    Dado que existe um inquilino "Inquilino Listagem BDD" criado via API
    Então devo ver "Inquilino Listagem BDD" na tabela de inquilinos

  @smoke
  Cenário: Cadastrar novo inquilino com sucesso
    Quando clico no botão de novo inquilino
    E preencho o nome do inquilino com "Inquilino Novo BDD"
    E preencho o email do inquilino com "bdd@example.com"
    E submeto o formulário de inquilino
    Então devo ver a confirmação de inquilino cadastrado
    E devo ver "Inquilino Novo BDD" na tabela de inquilinos

  Cenário: Não cadastrar inquilino sem nome
    Quando clico no botão de novo inquilino
    E submeto o formulário de inquilino sem preencher o nome
    Então o dialog de inquilino deve permanecer aberto

  Cenário: Desativar inquilino
    Dado que existe um inquilino "Inquilino Para Desativar BDD" criado via API
    Quando desativo o inquilino "Inquilino Para Desativar BDD"
    Então devo ver a confirmação de status alterado
