# Design: Playwright BDD com Gherkin

**Data:** 2026-05-12  
**Motivação:** Padronizar testes e2e com BDD (Gherkin) para consistência entre projetos da equipe.  
**Escopo:** Features novas apenas — specs existentes (`auth.spec.ts`, `critical-flows.spec.ts`) não serão migrados.

---

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Biblioteca BDD | `playwright-bdd` | Integração nativa com `@playwright/test`, zero fricção com stack existente |
| Idioma Gherkin | Português (`# language: pt`) | Alinhado com a base de código e times brasileiros |
| Configuração | Config separada (`playwright.bdd.config.ts`) | Isola BDD dos specs existentes sem quebrar nada |
| Ambiente/CI | Fora do escopo inicial | Definido em iteração futura |

---

## Estrutura de Arquivos

```
frontend/
├── e2e/                              # specs Playwright existentes (não mexer)
│   ├── auth.spec.ts
│   └── critical-flows.spec.ts
├── e2e-bdd/                          # novo diretório BDD
│   ├── features/                     # .feature files em PT-BR
│   │   └── autenticacao.feature      # exemplo inicial
│   ├── steps/                        # step definitions TypeScript
│   │   └── autenticacao.steps.ts
│   └── fixtures.ts                   # fixtures compartilhados
├── playwright.config.ts              # config existente (não mexer)
└── playwright.bdd.config.ts          # config separada para projetos BDD
```

---

## Fluxo de Execução

```
.feature (Gherkin PT-BR)
    ↓  bddgen (CLI do playwright-bdd)
.spec.ts gerado em e2e-bdd/.features-gen/
    ↓  playwright test --config=playwright.bdd.config.ts
relatórios HTML/JUnit (mesma infra do Playwright existente)
```

O diretório `.features-gen/` é gerado automaticamente e deve ser adicionado ao `.gitignore`.

---

## Configuração (`playwright.bdd.config.ts`)

```ts
import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'e2e-bdd/features/**/*.feature',
  steps: 'e2e-bdd/steps/**/*.steps.ts',
})

export default defineConfig({
  testDir,
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

---

## Scripts (`package.json`)

```json
"test:bdd":    "bddgen && playwright test --config=playwright.bdd.config.ts",
"test:bdd:ui": "bddgen && playwright test --config=playwright.bdd.config.ts --ui"
```

---

## Fixtures (`e2e-bdd/fixtures.ts`)

Estende o `test` base do Playwright para centralizar setup recorrente:

```ts
import { test as base } from '@playwright/test'

export const test = base.extend<{ logado: void }>({
  logado: async ({ page }, use) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'owner@example.com')
    await page.fill('input[name="password"]', 'senha123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    await use()
  },
})
```

Cenários autenticados usam a tag `@logado` no `.feature`.

---

## Step Definitions (`e2e-bdd/steps/*.steps.ts`)

```ts
import { createBdd } from 'playwright-bdd'
import { test } from '../fixtures'

const { Given, When, Then } = createBdd(test)

Given('que estou na página de login', async ({ page }) => {
  await page.goto('/login')
})

When('preencho o email {string} e a senha {string}', async ({ page }, email, senha) => {
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', senha)
})

When('clico em entrar', async ({ page }) => {
  await page.click('button[type="submit"]')
})

Then('devo ser redirecionado para o dashboard', async ({ page }) => {
  await page.waitForURL('/')
})
```

---

## Exemplo de Feature (`e2e-bdd/features/autenticacao.feature`)

```gherkin
# language: pt
Funcionalidade: Autenticação

  Cenário: Login com credenciais válidas
    Dado que estou na página de login
    Quando preencho o email "owner@example.com" e a senha "senha123"
    E clico em entrar
    Então devo ser redirecionado para o dashboard
```

---

## Convenções

- Um arquivo `.feature` por domínio (ex: `imoveis.feature`, `contratos.feature`)
- Steps reutilizáveis ficam em `steps/shared.steps.ts`
- Fixtures de domínio (ex: imóvel pré-cadastrado) ficam em `fixtures.ts` como extensões adicionais
- Tags padrão: `@logado` (requer autenticação), `@smoke` (testes críticos rápidos)
