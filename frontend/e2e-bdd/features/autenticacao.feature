# language: pt
Funcionalidade: Autenticação

  Cenário: Login com credenciais válidas
    Dado que estou na página de login
    Quando preencho o email "owner@example.com" e a senha "senha123"
    E clico em entrar
    Então devo ser redirecionado para o dashboard

  Cenário: Login com credenciais inválidas
    Dado que estou na página de login
    Quando preencho o email "errado@example.com" e a senha "senhaerrada"
    E clico em entrar
    Então devo permanecer na página de login
