## Why

Configurações hoje são páginas soltas (`/settings/profile`, `/settings/team`, `/settings/financial`, `/owner/settings`) sem a navegação lateral do canvas. As telas Segurança e Notificações do canvas também não existem. E a revisão do código achou uma **falha de segurança** no 2FA, que a tela de Segurança passaria a expor: `POST /auth/2fa/setup` aceita qualquer e-mail no corpo (não o usuário logado), troca o segredo e já marca o 2FA como ativo antes da confirmação.

## What Changes

- **Correção de segurança (backend):** `verifyTOTP` passa a validar de verdade (código errado não entra, nem no login); os códigos de recuperação passam de 4 para 10 dígitos; o setup do 2FA passa a valer só para o usuário autenticado, guarda o segredo como pendente e só ativa na confirmação do código, devolvendo os códigos de recuperação uma única vez; novo `POST /auth/password` para trocar a senha.
- **Frontend:** layout de Configurações com menu lateral (desktop) e lista de seções (celular); telas Perfil e Equipe com o visual do canvas e o mesmo comportamento; **Notificações** (`/settings/notifications`, substitui `/owner/settings`) e **Segurança** (`/settings/security`: senha e 2FA).
- Itens do menu ainda sem tela (Personalização, Plano e cobrança, Mensagens e cobrança, Regras financeiras, Categorias de despesa, Privacidade e dados) aparecem com o selo "Em breve"; Recebimento (Pix) leva à tela atual `/settings/financial`.
- Fora: fuso horário, foto, aparelhos conectados e "Sair de todos os outros aparelhos" (sem backend), coluna E-mail das notificações, matriz de papéis do canvas (os papéis do backend são outros).

## Capabilities

### New Capabilities
- `settings-navigation`: layout, menu, lista de seções e redirecionamentos de Configurações; Perfil e Equipe sob o novo layout.
- `account-security`: troca de senha e ativação, confirmação e desativação do 2FA, com a correção do setup.
- `notification-settings`: tela de preferências de aviso.

### Modified Capabilities
Nenhuma.

## Impact

- Backend `internal/identity`: `Setup2FA`, `VerifyAndEnable2FA`, nova troca de senha, repositório (`SaveTOTPSecret`, `SetPassword`), Swagger, `CLAUDE.md`. Sem migration (reaproveita `users.totp_secret` e `two_factor_enabled`).
- Frontend: `app/settings/*` (layout, perfil, equipe, notificações, segurança), `lib/nav.ts`, `app/owner/settings` vira redirecionamento, `lib/go/*` do 2FA e da senha.
- Segurança: mudança de contrato do `POST /auth/2fa/setup` (o corpo `email` deixa de existir). Nenhum cliente atual o usa além dos testes.
