# Deployment com Dokploy

Este documento descreve como fazer deploy do InquilinoTop usando Dokploy com auto-deploy na push para `main`.

## Pré-requisitos

- Dokploy rodando em um servidor (self-hosted)
- Acesso à UI ou CLI do Dokploy
- GitHub repository configurado com as chaves do Dokploy
- JWT keys geradas (`make keys`) — serão montadas via volume

## Visão Geral

```
GitHub Push (main)
    ↓
GitHub Actions CI/CD (testes)
    ↓
CI passa → Webhook dispara
    ↓
Dokploy recebe webhook
    ↓
Dokploy faz pull do código
    ↓
Build imagens (backend, frontend)
    ↓
Deploy automático
    ↓
Novo backend/frontend rodando
```

---

## 1. Configuração Inicial no Dokploy

### 1.1 Acessar UI Dokploy

```
https://<seu-dokploy-server>/dashboard
```

Login com suas credenciais.

### 1.2 Criar Projeto

- **Name:** `inquilinotop`
- **Repository:** `https://github.com/<seu-user>/inquilinoTop`
- **Branch:** `main`
- **Dockerfile Path:** (usa `dokploy.yaml` em vez de Dockerfile único)

### 1.3 Configurar Secrets/Env Vars

No Dokploy UI ou via CLI:

```bash
dokploy secret set --project inquilinotop \
  POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=<SENHA-SEGURA> \
  POSTGRES_DB=inquilinotop \
  DATABASE_URL="postgres://postgres:<SENHA-SEGURA>@postgres:5432/inquilinotop?sslmode=require" \
  TEST_DATABASE_URL="postgres://postgres:<SENHA-SEGURA>@postgres_test:5433/inquilinotop_test?sslmode=require" \
  JWT_PRIVATE_KEY_PATH=/app/keys/private.pem \
  JWT_PUBLIC_KEY_PATH=/app/keys/public.pem \
  CORS_ALLOWED_ORIGINS="https://seu-dominio.com,https://www.seu-dominio.com" \
  LOG_LEVEL=info \
  SMTP_HOST=<seu-smtp-host> \
  SMTP_PORT=587 \
  SMTP_USERNAME=<seu-usuario> \
  SMTP_PASSWORD=<sua-senha> \
  EMAIL_FROM="noreply@seu-dominio.com" \
  DOCUMENT_STORAGE_PATH=/app/storage/documents \
  PAYMENT_PROVIDER=asaas \
  APP_ENV=production
```

---

## 2. Configurar Auto-Deploy via GitHub Webhook

### 2.1 Obter URL Webhook do Dokploy

Via CLI:
```bash
dokploy webhook get --project inquilinotop
```

Via UI:
- Projeto → Settings → Webhooks
- Copy a URL webhook gerada

### 2.2 Adicionar Webhook no GitHub

No repositório:
1. Settings → Webhooks → Add webhook
2. **Payload URL:** Cole a URL do Dokploy
3. **Content type:** `application/json`
4. **Events:** `Push events`
5. **Branch filter:** `main`
6. **Active:** ✅ Ativado

---

## 3. Fazendo Deploy Automático

### 3.1 Push para main

```bash
git push origin main
```

Isto dispara:
1. ✅ GitHub Actions CI/CD (testes, segurança, build)
2. ✅ Se CI passar → Webhook envia para Dokploy
3. ✅ Dokploy faz pull do código
4. ✅ Build e push das imagens
5. ✅ Deploy dos containers

### 3.2 Monitorar Deploy

Via Dokploy UI:
- Projeto → Deployments
- Verá cada deployment com status: `Building` → `Deploying` → `Success` ou `Failed`

Via CLI:
```bash
dokploy deployment logs --project inquilinotop
```

---

## 4. Deploy Manual (sem webhook)

Se precisar fazer deploy manual, sem aguardar webhook:

### Via CLI
```bash
dokploy deploy --project inquilinotop
```

### Via UI
- Projeto → Deployments
- Botão "Deploy Now"

---

## 5. Rollback (Voltar para Deploy Anterior)

Se algo der errado e precisar voltar para a versão anterior:

### Via CLI
```bash
dokploy rollback --project inquilinotop --deployment <deployment-id>
```

### Via UI
- Projeto → Deployments
- Selecione o deployment anterior
- Clique "Rollback"

O sistema voltará para os containers da versão anterior.

---

## 6. Database Backups

Dokploy auto-faz backup diário do PostgreSQL.

### 6.1 Acessar Backups

Via UI:
- Projeto → postgres → Backups
- Verá lista de backups com timestamps

Via CLI:
```bash
dokploy database backups --name postgres
```

### 6.2 Restaurar de um Backup

**⚠️ CUIDADO: Esta operação destrói dados recentes!**

Via CLI:
```bash
dokploy database restore --name postgres --backup <backup-id>
```

Via UI:
- postgres → Backups
- Selecione backup
- Clique "Restore"

### 6.3 Fazer Backup Manual

```bash
dokploy database backup --name postgres
```

---

## 7. Acessando o Banco de Dados em Produção

### 7.1 Via Dokploy CLI

```bash
dokploy database shell --name postgres
```

Abrirá `psql` com acesso ao banco.

### 7.2 Via SSH direto no servidor

```bash
ssh usuario@seu-servidor
docker exec -it inquilinotop_postgres psql -U postgres -d inquilinotop
```

---

## 8. Logs e Debugging

### 8.1 Ver logs do backend

Via CLI:
```bash
dokploy logs --service backend --project inquilinotop --tail 100
```

Via Docker direto:
```bash
docker logs -f inquilinotop_backend
```

### 8.2 Ver logs do frontend

```bash
dokploy logs --service frontend --project inquilinotop --tail 100
```

### 8.3 Ver logs do banco

```bash
dokploy logs --service postgres --project inquilinotop --tail 50
```

---

## 9. Health Checks

Dokploy verifica saúde dos serviços automaticamente:

- **Backend:** GET `/health` a cada 30s
- **Frontend:** GET `http://localhost:3000` a cada 30s  
- **Postgres:** `pg_isready` a cada 10s

Se algum serviço falhar no health check por 3 tentativas consecutivas:
- Dokploy tenta restart automático
- Se falhar novamente, dispara alerta (se configurado)

---

## 10. Troubleshooting

### Deploy falha no CI/CD

1. Verifique logs do GitHub Actions: GitHub → Actions → Último push
2. Procure por erros em:
   - `backend-unit` — testes Go falhando?
   - `backend-integration` — testes de banco falhando?
   - `frontend-quality` — ESLint ou npm audit falhando?
   - `backend-security` — gosec ou golangci-lint flaggeou algo?

### Deploy falha no Dokploy

1. Acesse Dokploy UI → Deployments
2. Clique no deployment falho
3. Veja logs do build — erro de imagem? Env var faltando?

Comandos úteis:
```bash
dokploy deployment logs --project inquilinotop
dokploy deployment status --project inquilinotop
```

### Banco não inicia após deploy

1. Verifique se `DATABASE_URL` está correto
2. Verifique logs do postgres: `docker logs inquilinotop_postgres`
3. Se data foi corrompida, considere restore de backup

### Frontend mostra erro ao conectar no backend

1. Verifique se `CORS_ALLOWED_ORIGINS` está configurado com o domínio correto
2. Verifique se backend está rodando: `curl https://seu-dominio.com/health`
3. Verifique se `NEXT_PUBLIC_API_URL` está apontando pro backend certo

---

## 11. Produção Checklist Pré-Deploy

Antes do primeiro deploy em produção:

- [ ] Todos os secrets estão configurados em Dokploy?
- [ ] JWT keys foram geradas e estão em `backend/keys/`?
- [ ] CI/CD passou (GitHub Actions verde)?
- [ ] Backup do banco anterior foi feito?
- [ ] Dokploy webhook está ativado e testado?
- [ ] SSL/HTTPS está configurado em Dokploy?
- [ ] Domínios apontam corretamente para servidor Dokploy?
- [ ] Alertas estão configurados (Slack, email)?
- [ ] Você consegue fazer rollback se algo der errado?

---

## 12. URLs Úteis

| Serviço | URL |
|---|---|
| **Dokploy Dashboard** | `https://<seu-server>/dashboard` |
| **Frontend** | `https://seu-dominio.com` |
| **Backend API** | `https://seu-dominio.com/api/v1/*` |
| **Backend Swagger** | `https://seu-dominio.com/swagger/` |
| **Backend Health** | `https://seu-dominio.com/health` |
| **Backend Metrics** | `https://seu-dominio.com/metrics` |

---

## Referências

- [Dokumentação Dokploy](https://dokploy.com/docs)
- [CLI Dokploy](https://dokploy.com/docs/cli)
- [GitHub Webhooks](https://docs.github.com/webhooks)
