# language: pt
# frontend/e2e-bdd/features/pagamentos.feature
Funcionalidade: Gestão de Pagamentos

  Contexto:
    Dado que estou na página de pagamentos

  @smoke
  Cenário: Listar pagamentos existentes
    Dado que existe um pagamento pendente criado via API
    Quando navego para a lista de pagamentos
    Então devo ver pelo menos um pagamento na lista

  @smoke
  Cenário: Registrar pagamento manualmente
    Dado que existe um contrato ativo disponível para pagamento criado via API
    Quando clico no botão de novo pagamento
    E seleciono o contrato disponível no formulário de pagamento
    E seleciono o tipo de pagamento "RENT"
    E preencho a descrição do pagamento com "Aluguel BDD"
    E preencho o valor do pagamento com "1200"
    E preencho o vencimento com "2026-07-01"
    E submeto o formulário de pagamento
    Então devo ver a confirmação de pagamento registrado

  Cenário: Marcar pagamento como pago via API
    Dado que existe um pagamento pendente criado via API
    Quando marco o pagamento como pago via API
    Então o pagamento deve ter status PAID
