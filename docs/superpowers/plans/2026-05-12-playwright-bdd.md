# Playwright BDD (Gherkin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a testes e2e com Gherkin PT-BR ao frontend Next.js usando `playwright-bdd`, sem tocar nos specs Playwright existentes.

**Architecture:** `playwright-bdd` gera arquivos `.spec.ts` temporários a partir dos `.feature` files via `bddgen`, que então são executados pelo Playwright normal. A configuração BDD fica em `playwright.bdd.config.ts` separado do `playwright.config.ts` existente. Os step definitions ficam em `e2e-bdd/steps/` e o diretório gerado `e2e-bdd/.features-gen/` é ignorado pelo git.

**Tech Stack:** `playwright-bdd@^8.5.1`, `@playwright/test@^1.48.0` (já instalado), TypeScript, Gherkin PT-BR.

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modificar | `frontend/package.json` | Adicionar `playwright-bdd` em devDependencies e scripts `test:bdd` / `test:bdd:ui` |
| Modificar | `.gitignore` | Ignorar `frontend/e2e-bdd/.features-gen/` |
| Criar | `frontend/playwright.bdd.config.ts` | Config Playwright exclusiva para projetos BDD |
| Criar | `frontend/e2e-bdd/fixtures.ts` | Fixture `logado` (autenticação reutilizável) |
| Criar | `frontend/e2e-bdd/steps/autenticacao.steps.ts` | Step definitions de autenticação |
| Criar | `frontend/e2e-bdd/features/autenticacao.feature` | Feature file de exemplo em PT-BR |

---

## Task 1: Instalar `playwright-bdd` e configurar scripts

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Instalar o pacote**

Rodar dentro do container (ou localmente com Node instalado):

```bash
docker compose exec frontend npm install --save-dev playwright-bdd@^8.5.1
```

Saída esperada: `added 1 package` (ou similar). O `package-lock.json` será atualizado.

- [ ] **Step 2: Adicionar os scripts em `package.json`**

No bloco `"scripts"` de `frontend/package.json`, adicionar logo após `"test:e2e:ui"`:

```json
"test:bdd": "bddgen && playwright test --config=playwright.bdd.config.ts",
"test:bdd:ui": "bddgen && playwright test --config=playwright.bdd.config.ts --ui"
```

O bloco completo de scripts deve ficar:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:bdd": "bddgen && playwright test --config=playwright.bdd.config.ts",
  "test:bdd:ui": "bddgen && playwright test --config=playwright.bdd.config.ts --ui",
  "test:all": "npm run lint && npm run test && npm run test:e2e"
}
```

- [ ] **Step 3: Verificar instalação**

```bash
docker compose exec frontend npx bddgen --version
```

Saída esperada: número de versão (ex: `8.5.1`).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(e2e): instalar playwright-bdd e adicionar scripts test:bdd"
```

---

## Task 2: Configurar `.gitignore` e criar `playwright.bdd.config.ts`

**Files:**
- Modify: `.gitignore`
- Create: `frontend/playwright.bdd.config.ts`

- [ ] **Step 1: Adicionar `.features-gen/` ao `.gitignore`**

No `.gitignore` da raiz, dentro do bloco `# ── Frontend (Next.js)`, adicionar:

```
frontend/e2e-bdd/.features-gen/
```

- [ ] **Step 2: Criar `frontend/playwright.bdd.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'e2e-bdd/features/**/*.feature',
  steps: 'e2e-bdd/steps/**/*.steps.ts',
})

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/bdd-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 3: Verificar que o TypeScript compila sem erros**

```bash
docker compose exec frontend npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 4: Commit**

```bash
git add .gitignore frontend/playwright.bdd.config.ts
git commit -m "feat(e2e): adicionar config playwright-bdd e ignorar .features-gen"
```

---

## Task 3: Criar fixtures compartilhados

**Files:**
- Create: `frontend/e2e-bdd/fixtures.ts`

- [ ] **Step 1: Criar o arquivo de fixtures**

```ts
// frontend/e2e-bdd/fixtures.ts
import { test as base } from '@playwright/test'

export const test = base.extend<{ logado: void }>({
  logado: [async ({ page }, use) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'owner@example.com')
    await page.fill('input[name="password"]', 'senha123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    await use()
  }, { auto: false }],
})

export { expect } from '@playwright/test'
```

- [ ] **Step 2: Verificar TypeScript**

```bash
docker compose exec frontend npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e-bdd/fixtures.ts
git commit -m "feat(e2e): adicionar fixture logado para testes BDD autenticados"
```

---

## Task 4: Criar step definitions de autenticação

**Files:**
- Create: `frontend/e2e-bdd/steps/autenticacao.steps.ts`

- [ ] **Step 1: Criar o arquivo de steps**

```ts
// frontend/e2e-bdd/steps/autenticacao.steps.ts
import { createBdd } from 'playwright-bdd'
import { test } from '../fixtures'

const { Given, When, Then } = createBdd(test)

Given('que estou na página de login', async ({ page }) => {
  await page.goto('/login')
})

When('preencho o email {string} e a senha {string}', async ({ page }, email: string, senha: string) => {
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', senha)
})

When('clico em entrar', async ({ page }) => {
  await page.click('button[type="submit"]')
})

Then('devo ser redirecionado para o dashboard', async ({ page }) => {
  await page.waitForURL('/')
})

Then('devo permanecer na página de login', async ({ page }) => {
  await page.waitForURL(/.*\/login.*/)
})

Then('devo ver a mensagem de erro {string}', async ({ page }, mensagem: string) => {
  await page.waitForSelector(`text=${mensagem}`, { timeout: 5000 })
})
```

- [ ] **Step 2: Verificar TypeScript**

```bash
docker compose exec frontend npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e-bdd/steps/autenticacao.steps.ts
git commit -m "feat(e2e): adicionar step definitions de autenticação em PT-BR"
```

---

## Task 5: Criar feature file de autenticação e validar execução

**Files:**
- Create: `frontend/e2e-bdd/features/autenticacao.feature`

- [ ] **Step 1: Criar o feature file**

```gherkin
# language: pt
Funcionalidade: Autenticação

  Cenário: Login com credenciais válidas
    Dado que estou na página de login
    Quando preencho o email "owner@example.com" e a senha "senha123"
    E clico em entrar
    Então devo ser redirecionado para o dashboard

  Cenário: Login com credenciais inválidas
    Dado que estou na página de login
    Quando preencho o email "errado@example.com" e a senha "senhaerrada"
    E clico em entrar
    Então devo permanecer na página de login
```

- [ ] **Step 2: Rodar `bddgen` para gerar os specs temporários**

```bash
docker compose exec frontend npx bddgen --config=playwright.bdd.config.ts
```

Saída esperada: algo como `Generated: e2e-bdd/.features-gen/autenticacao.spec.ts`. Verificar que o arquivo foi criado:

```bash
ls frontend/e2e-bdd/.features-gen/
```

- [ ] **Step 3: Verificar que os specs existentes continuam funcionando**

```bash
docker compose exec frontend npx playwright test --config=playwright.config.ts --list
```

Saída esperada: lista com `auth.spec.ts` e `critical-flows.spec.ts`, sem erros.

- [ ] **Step 4: Verificar que os novos testes BDD aparecem**

```bash
docker compose exec frontend npx playwright test --config=playwright.bdd.config.ts --list
```

Saída esperada:

```
  [chromium] › autenticacao.feature:4 › Login com credenciais válidas
  [chromium] › autenticacao.feature:10 › Login com credenciais inválidas
```

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e-bdd/features/autenticacao.feature
git commit -m "feat(e2e): adicionar feature de autenticação em Gherkin PT-BR"
```

---

## Task 6: Adicionar README de uso no diretório BDD

**Files:**
- Create: `frontend/e2e-bdd/README.md`

- [ ] **Step 1: Criar o README**

```markdown
# e2e-bdd — Testes BDD com Gherkin

Testes end-to-end usando [playwright-bdd](https://github.com/vitalets/playwright-bdd) com Gherkin em Português.

## Estrutura

```
e2e-bdd/
├── features/       # .feature files em PT-BR (Dado/Quando/Então)
├── steps/          # step definitions TypeScript
├── fixtures.ts     # fixtures compartilhados (ex: usuário logado)
└── .features-gen/  # gerado automaticamente — não editar, ignorado pelo git
```

## Rodar testes

```bash
# Dentro do container
docker compose exec frontend npm run test:bdd

# Com UI interativa
docker compose exec frontend npm run test:bdd:ui
```

## Adicionar nova feature

1. Criar `features/<domínio>.feature` com `# language: pt`
2. Criar `steps/<domínio>.steps.ts` com os step definitions
3. Rodar `npx bddgen --config=playwright.bdd.config.ts` para verificar
4. Rodar `npm run test:bdd` para executar

## Tags disponíveis

| Tag | Significado |
|---|---|
| `@logado` | Cenário requer usuário autenticado (usa fixture `logado`) |
| `@smoke` | Teste crítico — deve passar sempre |
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e-bdd/README.md
git commit -m "docs(e2e): adicionar README de uso do diretório BDD"
```
