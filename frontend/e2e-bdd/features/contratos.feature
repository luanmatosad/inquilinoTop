# language: pt
# frontend/e2e-bdd/features/contratos.feature
Funcionalidade: Gestão de Contratos

  Contexto:
    Dado que estou na página de contratos

  @smoke
  Cenário: Listar contratos ativos
    Dado que existe um contrato ativo criado via API
    Então devo ver pelo menos um contrato na lista

  @smoke
  Cenário: Criar novo contrato com sucesso
    Dado que existe um imóvel com unidade disponível criado via API para contrato
    E que existe um inquilino disponível criado via API para contrato
    Quando clico no botão de novo contrato
    E seleciono a unidade disponível no formulário de contrato
    E seleciono o inquilino disponível no formulário de contrato
    E preencho a data de início com "2026-06-01"
    E preencho o valor do aluguel com "1500"
    E preencho o dia de pagamento com "5"
    E submeto o formulário de contrato
    Então devo ver a confirmação de contrato criado

  Cenário: Encerrar contrato
    Dado que existe um contrato ativo criado via API
    Quando encerro o contrato ativo
    Então devo ver a confirmação de contrato encerrado
