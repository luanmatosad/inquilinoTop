## Context

Canvas: `Configuracoes*` (menu interno de 11 itens, o mesmo em todas), `M-Config-lista` (lista no celular), `M-Config-seguranca`. Verificado no repo: `/settings` é um índice de cartões; Perfil usa `GET/PUT /auth/profile` (nome, tipo, CPF/CNPJ, telefone, endereço); Equipe usa `/organizations/me/members|invites` com papéis `owner|admin|manager|employee|viewer`; Notificações usa `/auth/notification-preferences` (6 campos) **mas nada no backend lê essas preferências**; o 2FA tem `setup`, `verify` e `disable`, sem nenhuma tela. **Achado de segurança:** `Setup2FAByEmail` busca o usuário pelo e-mail do corpo e `Enable2FA` grava o segredo com `two_factor_enabled=true`. Qualquer usuário logado pode, portanto, trocar e ativar o 2FA da conta de outra pessoa pelo e-mail (bloqueando o login dela e conhecendo o segredo), e o próprio usuário fica trancado se abandonar o setup. `VerifyAndEnable2FA` gera 10 códigos de recuperação mas nunca os devolve, e `UseBackupCode` compara texto puro. **Segunda falha, achada pelos testes:** `verifyTOTP` fazia `_, err := v.Validate(code); return err == nil`, mas a biblioteca devolve `(false, nil)` para código errado; logo qualquer código de 6 dígitos era aceito, inclusive em `LoginWith2FA` (quem soubesse a senha de uma conta com 2FA entrava com `000000`). O teste `TestService_Verify2FA` estava pulado ("needs review") por isso. Os códigos de recuperação tinham 4 dígitos (10 chances em 10.000).

## Goals / Non-Goals

**Goals:** corrigir o 2FA e entregar trocar senha; navegação de Configurações fiel ao canvas; telas Segurança e Notificações.
**Non-Goals:** fuso, foto, sessões/aparelhos, e-mail de notificação, matriz de papéis, hash dos códigos de recuperação (follow-up), as demais seções (ondas seguintes).

## Decisions

0. **Validação do TOTP.** `verifyTOTP` retorna `err == nil && ok`; teste de regressão no login (`LoginWith2FA` recusa código errado). Códigos de recuperação passam a 10 dígitos aleatórios.
1. **Setup do 2FA.** `POST /auth/2fa/setup` ignora o corpo e usa o usuário do contexto (e-mail lido do banco). Grava o segredo **pendente** (`SaveTOTPSecret`: `totp_secret` novo, `two_factor_enabled=false`, `backup_codes` nulos). Se o 2FA já está ativo: 409 `ALREADY_ENABLED` (é preciso desativar com a senha antes). `Setup2FAByEmail` é removido.
2. **Confirmação.** `POST /auth/2fa/verify` confere o código TOTP contra o segredo pendente, ativa (`two_factor_enabled=true`) e devolve os **10 códigos de recuperação (10 dígitos) uma única vez** no corpo. Verificar com o 2FA já ativo dá 409 `ALREADY_ENABLED` (não regenera códigos sem a senha). Código errado: 400 `INVALID_CODE`, segue desativado. Sem setup prévio: 409 `NOT_CONFIGURED`. Códigos de recuperação não valem para ativar (só TOTP). Desativar continua exigindo a senha.
3. **Trocar a senha.** `POST /auth/password` `{current_password, new_password}`: confere a atual com bcrypt (400 `INVALID_PASSWORD` se errada), aplica a mesma regra de tamanho do cadastro (400 `WEAK_PASSWORD`), recusa senha igual à atual, grava o novo hash (`SetPassword`). Não revoga outras sessões (não há lista de aparelhos): registrado como follow-up.
4. **Layout.** `app/settings/layout.tsx` com menu lateral em `md+` e, no celular, só o conteúdo com "‹ Configurações" voltando à lista. `/settings` (índice) vira a **lista de seções** (cartões, como `M-Config-lista`). O item "Configurações" do menu principal e da barra inferior aponta para `/settings/profile`, e `match` continua `/settings`. Definição única das seções em `lib/settings-nav.ts` (rotulo, rota, `soon`): Perfil, Personalização (em breve), Equipe e permissões, Plano e cobrança (em breve), Recebimento (Pix) → `/settings/financial`, Mensagens e cobrança (em breve), Regras financeiras (em breve), Categorias de despesa (em breve), Notificações, Segurança, Privacidade e dados (em breve). Itens "em breve" são texto com selo, sem link.
5. **Perfil e Equipe.** Mesmos dados e actions; só o visual do canvas. Perfil mantém CPF/CNPJ e endereço (necessários para contratos e recibos) num bloco "Dados para contratos e recibos"; o e-mail aparece como somente leitura; sem selo "Verificado", fuso e foto. Equipe mantém a lista e o convite atuais, com os papéis do backend (sem a matriz do canvas).
6. **Notificações.** `/settings/notifications` mostra três linhas com um interruptor cada ("No app"): "Inquilino avisou que pagou" (`notify_payment_received`), "Cobrança em atraso" (`notify_payment_overdue`) e "Contrato vencendo" (`notify_lease_expiring`, com dias de antecedência 1 a 90). O `PUT` substitui tudo, então a action devolve os campos que a tela não mostra (`notify_new_message`, `notify_maintenance_request`) com o valor gravado (como `preserveAddress` em Inquilinos). Aviso na tela: "Suas escolhas ficam salvas; os avisos no app chegam em breve." (nada lê as preferências hoje). `/owner/settings` redireciona para `/settings/notifications`.
7. **Segurança.** `/settings/security`: cartão Senha (formulário senha atual, nova e confirmação, validado com Zod) e cartão Verificação em duas etapas (estado vem de `GET /auth/profile`: `two_factor_enabled` precisa ser exposto, ver abaixo). Ativar: chama o setup, mostra o QR (`qrcode`, já instalado) e o segredo, pede o código de 6 dígitos, e ao confirmar mostra os códigos de recuperação **uma vez** com "Copiar" e a confirmação de que foram guardados. Desativar: pede a senha.
8. **Estado do 2FA no perfil.** `GET /auth/profile` passa a incluir `two_factor_enabled` (booleano; nunca o segredo nem os códigos).

## Risks / Trade-offs

- Mudança de contrato do setup: só testes o usam; os testes antigos (`TestHandler_Setup2FA_*`) são reescritos.
- Códigos de recuperação seguem em texto puro no banco (já era assim); hash entra como follow-up de segurança.
- Trocar senha não derruba outras sessões; depende de uma lista de aparelhos (futuro).
- Preferências de notificação ainda não geram avisos; a tela diz isso.
- Contas que ativaram o 2FA antes desta correção têm códigos de recuperação de 4 dígitos: ao desativar e ativar de novo ganham os novos.
- Quem ativou o 2FA pelo fluxo antigo continua ativo; usuários que ficaram com segredo "ativo mas nunca confirmado" não são detectáveis. Não há migration; o risco é baixo porque nenhum cliente chamava o setup.

## Migration Plan

Sem migration. Rollback: reverter os commits (o setup antigo volta, com a falha).

## Open Questions

Nenhuma bloqueante.
