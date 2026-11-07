#!/usr/bin/env bash
# Cria (de forma idempotente) um usuário de teste para o ambiente de DEV, com organização e papel owner.
# Uso: make seed-dev-user   (requer `make up`)
# SOMENTE desenvolvimento local. Nunca rodar contra produção.
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
DEV_USER_EMAIL="${DEV_USER_EMAIL:-teste@inquilinotop.dev}"
DEV_USER_PASSWORD="${DEV_USER_PASSWORD:-Teste@1234}"
DEV_ORG_NAME="${DEV_ORG_NAME:-Imobiliária de Teste}"

# 201 = criado, 409 = já existia (ambos ok). Qualquer outra coisa é erro.
status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DEV_USER_EMAIL\",\"password\":\"$DEV_USER_PASSWORD\"}")
case "$status" in
  201) echo "usuário criado: $DEV_USER_EMAIL" ;;
  409) echo "usuário já existia: $DEV_USER_EMAIL" ;;
  *) echo "falha ao registrar (HTTP $status). O backend está no ar? (make up)" >&2; exit 1 ;;
esac

# O cadastro não cria organização; sem ela a maioria das telas falha com NO_ORG.
docker compose exec -T postgres psql -U postgres -d inquilinotop -v ON_ERROR_STOP=1 \
  -v email="$DEV_USER_EMAIL" -v org="$DEV_ORG_NAME" <<'SQL'
WITH u AS (SELECT id FROM users WHERE email = :'email'),
o AS (
  INSERT INTO organizations (name)
  SELECT :'org' WHERE NOT EXISTS (SELECT 1 FROM organization_members m JOIN u ON u.id = m.user_id)
  RETURNING id
)
INSERT INTO organization_members (organization_id, user_id, role) SELECT o.id, u.id, 'owner' FROM o, u;
SQL

echo "pronto. Entre em http://localhost:3000/login com $DEV_USER_EMAIL (senha em scripts/seed-dev-user.sh)"
