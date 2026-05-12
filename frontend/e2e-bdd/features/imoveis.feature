# language: pt
# frontend/e2e-bdd/features/imoveis.feature
Funcionalidade: Gestão de Imóveis

  Contexto:
    Dado que estou autenticado

  @smoke
  Cenário: Listar imóveis existentes
    Dado que existe um imóvel "Imóvel Listagem BDD" do tipo "SINGLE" criado via API
    Quando navego para a lista de imóveis
    Então devo ver "Imóvel Listagem BDD" na lista

  @smoke
  Cenário: Criar imóvel do tipo SINGLE com sucesso
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E preencho o nome do imóvel com "Imóvel SINGLE BDD"
    E seleciono o tipo "SINGLE"
    E submeto o formulário de imóvel
    Então devo ver a confirmação de imóvel criado
    E devo ser redirecionado para a página do imóvel

  Cenário: Criar imóvel do tipo RESIDENTIAL com sucesso
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E preencho o nome do imóvel com "Imóvel RESIDENTIAL BDD"
    E seleciono o tipo "RESIDENTIAL"
    E submeto o formulário de imóvel
    Então devo ver a confirmação de imóvel criado

  Cenário: Não criar imóvel sem nome
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E submeto o formulário de imóvel sem preencher o nome
    Então o formulário não deve ser submetido

  Cenário: Excluir imóvel
    Dado que existe um imóvel "Imóvel Para Excluir BDD" do tipo "SINGLE" criado via API
    Quando navego para a página do imóvel "Imóvel Para Excluir BDD"
    E excluo o imóvel
    Então devo ser redirecionado para a lista de imóveis
    E "Imóvel Para Excluir BDD" não deve aparecer na lista
