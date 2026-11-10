## Why

A mensagem de cobrança é um texto fixo no código (`buildChargeMessage`): o dono não escolhe o tom, não tem lembretes diferentes para antes do vencimento, no dia e no atraso, e não vê como o texto vai sair. O canvas (`Configuracoes-mensagens`) traz a seção "Mensagens e cobrança": uma lista de lembretes (3 dias antes, no dia, 3 e 10 dias depois), cada um com um modelo editável com variáveis e uma prévia.

## What Changes

- Backend (`internal/settings`): lembretes da organização (nome, dias em relação ao vencimento, texto com variáveis) em `GET/PUT /settings/reminders`. Sem configuração, devolve os 4 lembretes do canvas. Valida tamanho, variáveis conhecidas e dias únicos.
- Frontend: tela `/settings/messages` (sai do "Em breve") com a lista, "Adicionar lembrete", editor com variáveis tocáveis e prévia com dados de exemplo.
- **Enviar cobrança** passa a usar o modelo do lembrete que se aplica aos dias até o vencimento (e o dono continua podendo editar o texto antes de enviar). Se os modelos não carregarem, usa o texto fixo de hoje.
- Fora: lembretes aparecendo em Hoje por agenda, com controle de "já enviei" (change própria, `lembretes-em-hoje`), canal por lembrete (hoje só WhatsApp e e-mail do diálogo), envio automático.

## Capabilities

### New Capabilities
- `charge-reminders`: lembretes e modelos de mensagem da organização (API, tela e escolha do modelo).

### Modified Capabilities
- `receivable-detail`: a mensagem de "Enviar cobrança" vem do modelo do lembrete aplicável.

## Impact

- Backend: migration 000054 (`reminder_templates`), `internal/settings` (model, service, repositório, handler), Swagger, `CLAUDE.md`.
- Frontend: `app/settings/messages`, `lib/message-templates.ts`, `app/financial/receivables/[id]/page.tsx` e `SendChargeDialog` (modelo), menu e testes.
