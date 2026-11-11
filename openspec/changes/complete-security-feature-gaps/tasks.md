# Tasks

## 0. Decisões antes de implementar

- [ ] 0.1 Decidir fonte de índices (IBGE SIDRA / FGV / entrada manual) e registrar ADR em `docs/decisions/`
- [ ] 0.2 Decidir retry: manter 5 ou reduzir para 3; atualizar spec conforme a escolha
- [ ] 0.3 Confirmar regra do aviso de 30 dias (contrato ativo, notificação única)

## 1. Reajuste por índice (`rent-index-adjustment`)

- [ ] 1.1 Endpoint de consulta de índices por período
- [ ] 1.2 Atualização de `index_values` a partir da fonte escolhida em 0.1
- [ ] 1.3 Aviso 30 dias antes do reajuste (scheduler diário, notificação única)
- [ ] 1.4 Scheduler anual de verificação de reajuste
- [ ] 1.5 Testes de comportamento: aviso, confirmação, sem confirmação

## 2. Notificações (`notification-email-templates`)

- [ ] 2.1 Templates de lembrete de cobrança e contrato vencendo
- [ ] 2.2 Erro de variável ausente falha sem envio parcial
- [ ] 2.3 Cron de agendamento de lembretes
- [ ] 2.4 Ajustar retry e estado `failed` conforme 0.2

## 3. Auditoria de mutações (`audit-mutation-logging`)

- [ ] 3.1 Middleware de auditoria para POST/PUT/PATCH/DELETE após resposta 2xx
- [ ] 3.2 Não gravar corpo com senha ou token
- [ ] 3.3 Testes de comportamento do middleware

## 4. Versionamento de API (`api-versioning`)

- [ ] 4.1 Grupo `/api/v2/` com os mesmos handlers de domínio
- [ ] 4.2 Header `X-API-Version` em v1 e v2
- [ ] 4.3 Documentar breaking changes em `backend/CHANGELOG.md`

## 5. Pendências dos itens parciais (sem delta spec)

- [ ] 5.1 Handlers existentes com autorização por role
- [ ] 5.2 Endpoint `POST /api/v1/auth/2fa/enable`
- [ ] 5.3 Upload de documentos: validar PDF e máximo 10MB
- [ ] 5.4 Campo `role` no model User, ou remover do escopo com registro no change
- [ ] 5.5 Teste de CORS com origens permitidas e negadas

## 6. Testes pendentes

- [ ] 6.1 Testes de integração de endpoints novos (`make test-backend-integration`)
- [ ] 6.2 E2E do fluxo 2FA
- [ ] 6.3 Stress de rate limiting
