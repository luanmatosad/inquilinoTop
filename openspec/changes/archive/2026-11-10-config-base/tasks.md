## 1. Backend (`internal/identity`)

- [x] 1.1 TDD: setup do 2FA só do usuário autenticado, segredo pendente (`two_factor_enabled=false`), 409 se já ativo, sem `Setup2FAByEmail`; reescrever os testes antigos de handler
- [x] 1.2 TDD: verify só com TOTP do segredo pendente, ativa e devolve os 10 códigos uma vez; 400 `INVALID_CODE` e 409 `NOT_CONFIGURED`
- [x] 1.3 TDD: `POST /auth/password` (senha atual errada, nova fraca, igual à atual, troca válida) e `two_factor_enabled` em `GET /auth/profile`
- [x] 1.4 Repositório (integração): `SaveTOTPSecret`, `SetPassword`, ativação; Swagger e `CLAUDE.md` do identity

## 2. Frontend

- [x] 2.1 `lib/settings-nav.ts`, `app/settings/layout.tsx` com menu lateral, índice `/settings` como lista, `nav.ts` e paleta de comandos, redirect de `/owner/settings`
- [x] 2.2 Perfil e Equipe com o visual do canvas, sem mudar dados nem actions
- [x] 2.3 `/settings/notifications` com as três linhas e os campos ocultos preservados
- [x] 2.4 `/settings/security`: senha, ativar 2FA (QR, código, códigos de recuperação uma vez) e desativar com a senha
- [x] 2.5 Testes de layout, perfil, notificações (campos preservados) e segurança

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), specs sincronizadas no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador: menu e lista, perfil, notificações, trocar senha e ativar/desativar 2FA numa conta de teste
