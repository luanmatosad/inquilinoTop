#!/bin/bash
# Dokploy Setup Script para InquilinoTop
# Este script guia você através da configuração do Dokploy com auto-deploy

set -e

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║         InquilinoTop — Dokploy Setup Script                          ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se Dokploy CLI está instalado
if ! command -v dokploy &> /dev/null; then
    echo "❌ dokploy CLI não encontrado. Instale em: https://dokploy.com/docs/cli"
    exit 1
fi

echo "✅ dokploy CLI encontrado"
echo ""

# 1. Criar projeto no Dokploy
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 1: Criar Projeto no Dokploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Execute via UI Dokploy ou use:"
echo "  dokploy project create \\"
echo "    --name inquilinotop \\"
echo "    --repository https://github.com/<seu-user>/inquilinoTop \\"
echo "    --branch main"
echo ""
read -p "Pressione ENTER quando o projeto estiver criado no Dokploy..."
echo ""

# 2. Configurar Secrets
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 2: Configurar Secrets (Environment Variables)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "As seguintes variáveis de ambiente são obrigatórias:"
echo "  • POSTGRES_PASSWORD — senha segura do PostgreSQL"
echo "  • DATABASE_URL — URL de conexão ao banco de dados"
echo "  • TEST_DATABASE_URL — URL de conexão ao banco de testes"
echo "  • CORS_ALLOWED_ORIGINS — domínios permitidos (ex: https://seu-dominio.com)"
echo ""
echo "Exemplo de comando (copie e adapte):"
cat << 'EOF'

dokploy secret set \
  --project inquilinotop \
  POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=GERE_UMA_SENHA_SEGURA_AQUI \
  POSTGRES_DB=inquilinotop \
  DATABASE_URL="postgres://postgres:SENHA@postgres:5432/inquilinotop?sslmode=require" \
  TEST_DATABASE_URL="postgres://postgres:SENHA@postgres_test:5432/inquilinotop_test?sslmode=require" \
  CORS_ALLOWED_ORIGINS="https://seu-dominio.com,https://www.seu-dominio.com" \
  JWT_PRIVATE_KEY_PATH=/app/keys/private.pem \
  JWT_PUBLIC_KEY_PATH=/app/keys/public.pem \
  APP_ENV=production \
  LOG_LEVEL=info \
  PAYMENT_PROVIDER=asaas \
  SMTP_HOST=seu-smtp-host \
  SMTP_PORT=587 \
  SMTP_USERNAME=seu-usuario \
  SMTP_PASSWORD=sua-senha \
  EMAIL_FROM=noreply@seu-dominio.com \
  DOCUMENT_STORAGE_PATH=/app/storage/documents

EOF
echo ""
read -p "Pressione ENTER quando os secrets estiverem configurados..."
echo ""

# 3. Fazer primeiro deploy
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 3: Fazer Primeiro Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Via CLI:"
echo "  dokploy deploy --project inquilinotop"
echo ""
echo "Ou via UI Dokploy → inquilinotop → Deploy Now"
echo ""
read -p "Pressione ENTER quando o primeiro deploy estiver completo..."
echo ""

# 4. Habilitar auto-deploy
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 4: Habilitar Auto-Deploy via GitHub Webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Obtenha o webhook token do Dokploy:"
echo "   dokploy webhook get --project inquilinotop"
echo ""
echo "2. Copie a URL do webhook"
echo ""
echo "3. No GitHub:"
echo "   - Acesse: Settings → Webhooks → Add webhook"
echo "   - Payload URL: (cole a URL do Dokploy)"
echo "   - Content type: application/json"
echo "   - Events: Push events"
echo "   - Branch filter: main"
echo "   - Clique em 'Add webhook'"
echo ""
read -p "Pressione ENTER quando o webhook estiver configurado..."
echo ""

# 5. Verificar Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 5: Verificar Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Verifique o status do deploy:"
echo "  dokploy deployment logs --project inquilinotop"
echo ""
echo "Acesse a aplicação:"
echo "  Frontend: https://seu-dominio.com"
echo "  Backend API: https://seu-dominio.com/api/v1/*"
echo "  Backend Swagger: https://seu-dominio.com/swagger/"
echo "  Health Check: https://seu-dominio.com/health"
echo "  Métricas: https://seu-dominio.com/metrics"
echo ""

# 6. Teste de auto-deploy
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASSO 6: Testar Auto-Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para testar se auto-deploy funciona:"
echo ""
echo "1. Faça uma mudança trivial (ex: comentário no README)"
echo "2. Commit e push para main:"
echo "   git add README.md"
echo "   git commit -m 'test: auto-deploy webhook'"
echo "   git push origin main"
echo ""
echo "3. Monitore o deploy:"
echo "   dokploy deployment logs --project inquilinotop"
echo ""
echo "4. Quando terminar, verifique que a app rodou com a mudança"
echo ""
read -p "Pressione ENTER quando confirmar que auto-deploy funciona..."
echo ""

# 7. Resumo
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Setup Dokploy Completo!                         ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Próximos passos:"
echo "  • Backups automáticos estão habilitados (diários)"
echo "  • SSL/HTTPS está gerenciado por Dokploy (Let's Encrypt)"
echo "  • Auto-deploy está ativo para push em main"
echo ""
echo "Para mais informações, veja:"
echo "  docs/dokploy-deploy.md"
echo ""
echo "Comandos úteis:"
echo "  dokploy deployment logs --project inquilinotop"
echo "  dokploy logs --service backend --project inquilinotop"
echo "  dokploy logs --service frontend --project inquilinotop"
echo "  dokploy database backups --name postgres"
echo ""
