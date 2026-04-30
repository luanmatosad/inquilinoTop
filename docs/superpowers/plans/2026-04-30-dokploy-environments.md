# Dokploy Staging + Produção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o codebase para deploy em staging e produção via Dokploy no Hostinger, com auto-deploy via GitHub Actions.

**Architecture:** 4 Applications no Dokploy (backend-staging, frontend-staging, backend-prod, frontend-prod) usando Dockerfiles de prod já existentes. JWT keys lidas de variável de ambiente. GitHub Actions dispara webhook do Dokploy após testes verdes.

**Tech Stack:** Go 1.25, Next.js 20, Docker multi-stage, GitHub Actions, Dokploy webhooks

**Spec de referência:** `docs/superpowers/specs/2026-04-30-dokploy-environments-design.md`

---

## Mapa de Arquivos

| Ação | Arquivo | O que muda |
|---|---|---|
| Criar | `backend/pkg/auth/keys.go` | Função `LoadPrivateKeyFromEnvOrFile` — carrega RSA key de env ou arquivo |
| Criar | `backend/pkg/auth/keys_test.go` | Testes da função acima |
| Modificar | `backend/cmd/api/main.go` | Substituir `mustLoadPrivateKey` pela nova função |
| Modificar | `frontend/Dockerfile` | Adicionar `ARG NEXT_PUBLIC_API_URL` no stage builder |
| Modificar | `.github/workflows/ci.yml` | Adicionar job `deploy` condicionado a testes verdes |

---

## Task 1: Carregar JWT key de variável de ambiente

**Contexto:** Hoje `main.go` só suporta `JWT_PRIVATE_KEY_PATH` (caminho de arquivo). Em containers de prod não há arquivo montado — a chave vem de env var. Vamos adicionar `LoadPrivateKeyFromEnvOrFile` em `pkg/auth` e atualizar o `main.go`.

**Files:**
- Create: `backend/pkg/auth/keys.go`
- Create: `backend/pkg/auth/keys_test.go`
- Modify: `backend/cmd/api/main.go`

---

- [ ] **Step 1: Escrever o teste que vai falhar**

Crie `backend/pkg/auth/keys_test.go`:

```go
package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestPEM(t *testing.T) []byte {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	keyBytes := x509.MarshalPKCS1PrivateKey(privKey)
	return pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: keyBytes})
}

func TestLoadPrivateKeyFromEnvOrFile_FromEnv(t *testing.T) {
	pemData := generateTestPEM(t)
	t.Setenv("JWT_PRIVATE_KEY", string(pemData))
	t.Setenv("JWT_PRIVATE_KEY_PATH", "")

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_FromFile(t *testing.T) {
	pemData := generateTestPEM(t)
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "private.pem")
	require.NoError(t, os.WriteFile(keyPath, pemData, 0600))
	t.Setenv("JWT_PRIVATE_KEY", "")
	t.Setenv("JWT_PRIVATE_KEY_PATH", keyPath)

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_EnvTakesPrecedence(t *testing.T) {
	pemData := generateTestPEM(t)
	t.Setenv("JWT_PRIVATE_KEY", string(pemData))
	t.Setenv("JWT_PRIVATE_KEY_PATH", "/nonexistent/should/be/ignored.pem")

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_NeitherSet(t *testing.T) {
	t.Setenv("JWT_PRIVATE_KEY", "")
	t.Setenv("JWT_PRIVATE_KEY_PATH", "")

	_, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	assert.Error(t, err)
}
```

- [ ] **Step 2: Rodar o teste — confirmar que falha**

```bash
docker compose exec backend go test ./pkg/auth/... -run TestLoadPrivateKey -v
```

Esperado: `FAIL — auth.LoadPrivateKeyFromEnvOrFile undefined`

- [ ] **Step 3: Implementar `keys.go`**

Crie `backend/pkg/auth/keys.go`:

```go
package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"os"
)

// LoadPrivateKeyFromEnvOrFile carrega uma RSA private key do conteúdo da env envKey
// (PEM direto ou base64-encoded PEM) ou, se não definida, lê o arquivo apontado por pathKey.
func LoadPrivateKeyFromEnvOrFile(envKey, pathKey string) (*rsa.PrivateKey, error) {
	if content := os.Getenv(envKey); content != "" {
		return parseRSAPrivateKey([]byte(content))
	}
	path := os.Getenv(pathKey)
	if path == "" {
		return nil, fmt.Errorf("auth: neither %s nor %s is set", envKey, pathKey)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("auth: read key file: %w", err)
	}
	return parseRSAPrivateKey(data)
}

func parseRSAPrivateKey(data []byte) (*rsa.PrivateKey, error) {
	// Aceita base64-encoded PEM (útil para armazenar em env vars sem quebras de linha)
	if decoded, err := base64.StdEncoding.DecodeString(string(data)); err == nil {
		data = decoded
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("auth: failed to decode PEM block")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("auth: parse private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("auth: key is not RSA")
	}
	return rsaKey, nil
}
```

- [ ] **Step 4: Rodar o teste — confirmar que passa**

```bash
docker compose exec backend go test ./pkg/auth/... -run TestLoadPrivateKey -v
```

Esperado: `PASS` nos 4 testes.

- [ ] **Step 5: Atualizar `main.go` para usar a nova função**

Em `backend/cmd/api/main.go`, substitua o bloco:

```go
privKey := mustLoadPrivateKey(mustEnv("JWT_PRIVATE_KEY_PATH"))
```

por:

```go
privKey, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
if err != nil {
    slog.Error("failed to load private key", "error", err)
    os.Exit(1)
}
```

E remova a função `mustLoadPrivateKey` inteira (era usada só aqui):

```go
// REMOVER este bloco completo:
func mustLoadPrivateKey(path string) *rsa.PrivateKey {
    // ... todo o corpo
}
```

- [ ] **Step 6: Confirmar que o backend compila**

```bash
docker compose exec backend go build ./cmd/api/
```

Esperado: sem erros.

- [ ] **Step 7: Rodar todos os testes unitários**

```bash
make test-backend
```

Esperado: todos passam.

- [ ] **Step 8: Commit**

```bash
git add backend/pkg/auth/keys.go backend/pkg/auth/keys_test.go backend/cmd/api/main.go
git commit -m "feat(auth): load JWT private key from env var or file path"
```

---

## Task 2: NEXT_PUBLIC_API_URL injetável no build do frontend

**Contexto:** O Next.js embute variáveis `NEXT_PUBLIC_*` no bundle em build-time. O `frontend/Dockerfile` atual não passa nenhuma `NEXT_PUBLIC_API_URL` para o stage builder — o valor vem do `.env` local ou fica vazio em prod. Precisamos que o Dokploy injete o valor correto via `--build-arg` no momento do build.

**Files:**
- Modify: `frontend/Dockerfile`

---

- [ ] **Step 1: Atualizar `frontend/Dockerfile`**

Substitua o conteúdo atual por:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

A única mudança é `ARG NEXT_PUBLIC_API_URL` antes do `RUN npm run build`. O Next.js detecta automaticamente variáveis de ambiente com prefixo `NEXT_PUBLIC_` presentes durante o build.

- [ ] **Step 2: Testar o build localmente passando o ARG**

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
  -t frontend-test \
  ./frontend
```

Esperado: build completo sem erros, imagem criada.

- [ ] **Step 3: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat(frontend): accept NEXT_PUBLIC_API_URL as build arg in production Dockerfile"
```

---

## Task 3: Adicionar job de deploy no GitHub Actions

**Contexto:** O CI atual só roda testes — sem deploy. Vamos adicionar um job `deploy` que dispara o webhook do Dokploy apenas quando testes passam e apenas nos branches `develop` (→ staging) e `main` (→ prod).

**Files:**
- Modify: `.github/workflows/ci.yml`

---

- [ ] **Step 1: Adicionar o job `deploy` no final de `.github/workflows/ci.yml`**

Após o job `docker-build` existente, adicione:

```yaml
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: [backend-unit, backend-integration, frontend-quality]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main')
    steps:
      - name: Trigger staging deploy
        if: github.ref == 'refs/heads/develop'
        run: |
          curl -s -f -X POST "${{ secrets.DOKPLOY_WEBHOOK_STAGING }}" \
            -H "Content-Type: application/json" || echo "Webhook staging falhou"

      - name: Trigger production deploy
        if: github.ref == 'refs/heads/main'
        run: |
          curl -s -f -X POST "${{ secrets.DOKPLOY_WEBHOOK_PROD }}" \
            -H "Content-Type: application/json" || echo "Webhook prod falhou"
```

**Nota:** O job `deploy` não tem dependência de `docker-build` intencionalmente — `docker-build` valida as imagens de dev (`Dockerfile.dev`), enquanto o Dokploy builda a partir dos `Dockerfile` de prod diretamente.

- [ ] **Step 2: Validar YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML válido"
```

Esperado: `YAML válido`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add deploy job to trigger Dokploy webhooks after tests pass"
```

---

## Task 4: Configurar secrets no GitHub

**Contexto:** O job de deploy usa `secrets.DOKPLOY_WEBHOOK_STAGING` e `secrets.DOKPLOY_WEBHOOK_PROD`. Esses valores vêm do painel do Dokploy após criar as Applications lá.

**Files:** nenhum arquivo de código — ação manual no GitHub e Dokploy.

---

- [ ] **Step 1: Obter URLs de webhook do Dokploy**

No painel do Dokploy, para cada Application (`backend-staging`, `frontend-staging`, `backend-prod`, `frontend-prod`):
1. Abrir a Application → aba **General** → seção **Deploy Webhook**
2. Copiar a URL (formato: `https://<seu-dokploy>/api/deploy/<token>`)

Você precisará de 4 URLs — uma por Application.

- [ ] **Step 2: Adicionar secrets no GitHub**

No repositório GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `DOKPLOY_WEBHOOK_STAGING` | URL do webhook do `backend-staging` (ou um webhook único que dispara ambos, se o Dokploy suportar) |
| `DOKPLOY_WEBHOOK_PROD` | URL do webhook do `backend-prod` |

**Nota:** O frontend é redeploy'd automaticamente quando o backend faz deploy, pois ambos estão no mesmo projeto Dokploy. Se o Dokploy não fizer isso automaticamente, você precisará de 4 secrets separados e 4 steps no job de deploy.

- [ ] **Step 3: Testar o pipeline completo**

Faça um push qualquer para `develop`:

```bash
git push origin develop
```

No GitHub Actions, verificar:
1. Jobs `backend-unit`, `backend-integration`, `frontend-quality` passam
2. Job `deploy` é disparado e executa o step "Trigger staging deploy"
3. No painel do Dokploy, a Application staging aparece em estado "Deploying"

---

## Task 5: Checklist de configuração do Dokploy (referência)

Esta task documenta os passos manuais de configuração no painel do Dokploy. Não há código para commitar.

---

- [ ] **Instalar Dokploy no VPS Hostinger**

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Acesse `http://<IP-DO-VPS>:3000` e complete o setup inicial.

- [ ] **Criar banco de dados staging** no provedor managed (Neon ou Hostinger):
  - Nome: `inquilinotop_staging`
  - Guardar a `DATABASE_URL` completa

- [ ] **Criar banco de dados prod** no provedor managed:
  - Nome: `inquilinotop_prod`
  - Guardar a `DATABASE_URL` completa

- [ ] **Gerar par de chaves RSA para staging**:

```bash
openssl genrsa -out staging_private.pem 2048
openssl rsa -in staging_private.pem -pubout -out staging_public.pem
cat staging_private.pem  # copiar para JWT_PRIVATE_KEY no Dokploy
```

- [ ] **Gerar par de chaves RSA para prod** (par diferente do staging):

```bash
openssl genrsa -out prod_private.pem 2048
openssl rsa -in prod_private.pem -pubout -out prod_public.pem
cat prod_private.pem  # copiar para JWT_PRIVATE_KEY no Dokploy
```

- [ ] **Criar Application `backend-staging` no Dokploy**:
  - Source: GitHub, repo `inquilinoTop`, branch `develop`
  - Build: Dockerfile em `backend/Dockerfile`
  - Port: `8080`
  - Variáveis de ambiente:
    ```
    APP_ENV=staging
    PORT=8080
    DATABASE_URL=<url do banco staging>
    JWT_PRIVATE_KEY=<conteúdo do staging_private.pem>
    CORS_ALLOWED_ORIGINS=<URL do frontend-staging após criá-lo>
    LOG_LEVEL=debug
    MIGRATIONS_PATH=./migrations
    ```

- [ ] **Criar Application `frontend-staging` no Dokploy**:
  - Source: GitHub, repo `inquilinoTop`, branch `develop`
  - Build: Dockerfile em `frontend/Dockerfile`
  - Build Args: `NEXT_PUBLIC_API_URL=<URL pública do backend-staging>`
  - Port: `3000`
  - Variáveis de ambiente:
    ```
    NODE_ENV=production
    NEXT_PUBLIC_API_URL=<URL pública do backend-staging>
    NEXT_PUBLIC_SUPABASE_URL=<url do supabase>
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
    ```

- [ ] **Criar Application `backend-prod` no Dokploy** (mesmos campos, branch `main`, banco prod, chaves RSA de prod)

- [ ] **Criar Application `frontend-prod` no Dokploy** (mesmos campos, branch `main`, URL do backend-prod)

- [ ] **Copiar URLs de webhook** de cada Application (aba General → Deploy Webhook) e adicionar como secrets no GitHub (ver Task 4)

- [ ] **Primeiro deploy manual**: clicar "Deploy" em cada Application para validar que o build funciona antes de depender do CI
