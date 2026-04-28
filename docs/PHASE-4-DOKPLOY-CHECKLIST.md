# Phase 4 — Dokploy Setup Checklist

Este documento é um checklist rápido para setup do Dokploy. Para instruções detalhadas, veja `docs/dokploy-deploy.md`.

## ✅ Pré-requisitos

- [ ] Dokploy rodando em um servidor (self-hosted)
- [ ] Acesso à Dokploy UI ou CLI
- [ ] Repositório GitHub sincronizado
- [ ] JWT keys geradas (`make keys`)

## ✅ Arquivos Criados

- [x] `dokploy.yaml` — Configuração de infraestrutura (docker-compose com auto-deploy)
- [x] `docs/dokploy-deploy.md` — Documentação completa de deployment
- [x] `scripts/dokploy-setup.sh` — Script guiado de setup

## ✅ Passos de Setup

### Passo 1: Criar Projeto no Dokploy
```bash
dokploy project create \
  --name inquilinotop \
  --repository https://github.com/<seu-user>/inquilinoTop \
  --branch main
```

### Passo 2: Configurar Secrets (Variáveis de Ambiente)

Todas as variáveis em `.env.example` devem ser setadas no Dokploy:

```bash
dokploy secret set \
  --project inquilinotop \
  POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=<SENHA_SEGURA> \
  POSTGRES_DB=inquilinotop \
  DATABASE_URL="postgres://postgres:<SENHA>@postgres:5432/inquilinotop?sslmode=require" \
  TEST_DATABASE_URL="postgres://postgres:<SENHA>@postgres_test:5433/inquilinotop_test?sslmode=require" \
  CORS_ALLOWED_ORIGINS="https://seu-dominio.com" \
  JWT_PRIVATE_KEY_PATH=/app/keys/private.pem \
  JWT_PUBLIC_KEY_PATH=/app/keys/public.pem \
  APP_ENV=production \
  LOG_LEVEL=info \
  PAYMENT_PROVIDER=asaas \
  SMTP_HOST=<smtp-host> \
  SMTP_PORT=587 \
  SMTP_USERNAME=<usuario> \
  SMTP_PASSWORD=<senha> \
  EMAIL_FROM=noreply@seu-dominio.com \
  DOCUMENT_STORAGE_PATH=/app/storage/documents
```

### Passo 3: Fazer Primeiro Deploy

```bash
dokploy deploy --project inquilinotop
```

Ou via UI: Dokploy → inquilinotop → Deploy Now

### Passo 4: Configurar GitHub Webhook para Auto-Deploy

1. **Obter URL webhook do Dokploy:**
   ```bash
   dokploy webhook get --project inquilinotop
   ```

2. **Adicionar webhook no GitHub:**
   - Repository → Settings → Webhooks → Add webhook
   - Payload URL: (cole a URL do Dokploy)
   - Content type: `application/json`
   - Events: Push events
   - Branch filter: `main`

### Passo 5: Testar Auto-Deploy

```bash
# 1. Fazer uma mudança trivial
echo "# Test" >> README.md

# 2. Commit e push
git add README.md
git commit -m "test: auto-deploy"
git push origin main

# 3. Monitorar deploy
dokploy deployment logs --project inquilinotop

# 4. Verificar que a app atualizou
curl https://seu-dominio.com/health
```

## ✅ Verificação Pós-Deploy

- [ ] Frontend acessível em `https://seu-dominio.com`
- [ ] Backend API respondendo em `/api/v1/`
- [ ] Swagger UI em `/swagger/`
- [ ] Health check em `/health` retorna `{"status": "ok"}`
- [ ] Métricas Prometheus em `/metrics`
- [ ] SSL/HTTPS ativo (Dokploy gerencia Let's Encrypt)
- [ ] Backups automáticos habilitados
- [ ] Auto-deploy funciona (test push confirma)

## ✅ Comandos Úteis

```bash
# Ver status do deploy
dokploy deployment logs --project inquilinotop

# Ver logs do backend
dokploy logs --service backend --project inquilinotop

# Ver logs do frontend
dokploy logs --service frontend --project inquilinotop

# Listar backups do banco
dokploy database backups --name postgres

# Fazer backup manual
dokploy database backup --name postgres

# Fazer rollback
dokploy rollback --project inquilinotop --deployment <deployment-id>

# Shell no banco (psql)
dokploy database shell --name postgres
```

## 🚀 Próximos Passos

- [ ] Configurar monitoring (Prometheus, alertas)
- [ ] Teste de carga (`scripts/load-test.js`)
- [ ] Frontend tests (Phase 5)
- [ ] Responsiveness checklist (Phase 6)

## 📚 Documentação

- `docs/dokploy-deploy.md` — Guia completo de deployment, rollback, restore
- `dokploy.yaml` — Configuração de infraestrutura (IaC)
- `scripts/dokploy-setup.sh` — Script interativo de setup

## ⚠️ Importante

- **Senha do PostgreSQL:** Mude de `postgres` em produção! Use uma senha forte.
- **JWT Keys:** Devem estar em `backend/keys/` (gitignored, não commitadas)
- **CORS:** Configure com seus domínios reais em produção
- **Backups:** Dokploy faz diariamente, retenção de 30 dias (configurável em `dokploy.yaml`)
- **SSL:** Automático via Let's Encrypt, renovado a cada 90 dias
