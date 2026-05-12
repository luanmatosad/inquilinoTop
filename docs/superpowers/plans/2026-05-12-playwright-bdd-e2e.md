# Playwright BDD E2E — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cobertura BDD (Gherkin PT-BR) com Page Objects e storageState para os domínios imóveis, inquilinos, contratos e pagamentos.

**Architecture:** `globalSetup` faz login via API Go e salva token em `.auth/api-token.json` + storageState de browser em `.auth/user.json`. Steps usam o token para criar/destruir dados via Go API; Page Objects encapsulam seletores e ações da UI. Cada domínio tem seu próprio `.feature`, `.steps.ts` e `Page.ts`.

**Tech Stack:** `@playwright/test` 1.48, `playwright-bdd` 8.5, TypeScript, Next.js 16, Go API em `:8080`

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `frontend/e2e-bdd/global-setup.ts` | Login API + storageState |
| Modificar | `frontend/playwright.bdd.config.ts` | globalSetup + storageState |
| Modificar | `frontend/.gitignore` | Ignorar `.auth/` |
| Modificar | `frontend/e2e-bdd/fixtures.ts` | Fixture `apiToken` |
| Criar | `frontend/e2e-bdd/pages/PropertiesPage.ts` | POM para imóveis |
| Criar | `frontend/e2e-bdd/features/imoveis.feature` | Cenários BDD de imóveis |
| Criar | `frontend/e2e-bdd/steps/imoveis.steps.ts` | Step definitions de imóveis |
| Criar | `frontend/e2e-bdd/pages/TenantsPage.ts` | POM para inquilinos |
| Criar | `frontend/e2e-bdd/features/inquilinos.feature` | Cenários BDD de inquilinos |
| Criar | `frontend/e2e-bdd/steps/inquilinos.steps.ts` | Step definitions de inquilinos |
| Criar | `frontend/e2e-bdd/pages/LeasesPage.ts` | POM para contratos |
| Criar | `frontend/e2e-bdd/features/contratos.feature` | Cenários BDD de contratos |
| Criar | `frontend/e2e-bdd/steps/contratos.steps.ts` | Step definitions de contratos |
| Criar | `frontend/e2e-bdd/pages/PaymentsPage.ts` | POM para pagamentos |
| Criar | `frontend/e2e-bdd/features/pagamentos.feature` | Cenários BDD de pagamentos |
| Criar | `frontend/e2e-bdd/steps/pagamentos.steps.ts` | Step definitions de pagamentos |

---

## Task 1: Setup de Autenticação Global

Antes de qualquer teste BDD, um `globalSetup` faz login no Go API e salva o token + storageState do browser. Assim os testes não precisam fazer login via UI a cada cenário.

**Contexto de seletores da tela de login:**
- Email: `input[name="email"]`
- Senha: `input[name="password"]`
- Submit: `button[type="submit"]`
- Redirect pós-login: `http://localhost:3000/`

**Files:**
- Create: `frontend/e2e-bdd/global-setup.ts`
- Modify: `frontend/playwright.bdd.config.ts`
- Modify: `frontend/.gitignore`
- Modify: `frontend/e2e-bdd/fixtures.ts`

- [ ] **Step 1.1: Criar `global-setup.ts`**

```ts
// frontend/e2e-bdd/global-setup.ts
import { chromium, request } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'
const EMAIL = process.env.E2E_USER_EMAIL ?? 'owner@example.com'
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'senha123'
const AUTH_DIR = path.resolve('e2e-bdd/.auth')

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  // 1. Obter token via Go API (usado nos steps para criar/deletar dados)
  const ctx = await request.newContext({ baseURL: API_URL })
  const loginRes = await ctx.post('/api/v1/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  })
  if (!loginRes.ok()) {
    throw new Error(`globalSetup: login falhou — ${loginRes.status()} ${await loginRes.text()}`)
  }
  const { data } = await loginRes.json()
  fs.writeFileSync(
    path.join(AUTH_DIR, 'api-token.json'),
    JSON.stringify({ token: data.access_token }),
  )
  await ctx.dispose()

  // 2. Obter storageState do browser (cookies httpOnly do Next.js auth)
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/`)
  await page.context().storageState({ path: path.join(AUTH_DIR, 'user.json') })
  await browser.close()
}
```

- [ ] **Step 1.2: Adicionar `.auth/` ao `.gitignore`**

Abrir `frontend/.gitignore` e adicionar:

```
# Playwright auth state (gerado pelo globalSetup)
e2e-bdd/.auth/
```

- [ ] **Step 1.3: Atualizar `playwright.bdd.config.ts`**

```ts
// frontend/playwright.bdd.config.ts
import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'e2e-bdd/features/**/*.feature',
  steps: ['e2e-bdd/steps/**/*.steps.ts', 'e2e-bdd/fixtures.ts'],
})

export default defineConfig({
  testDir,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  globalSetup: './e2e-bdd/global-setup.ts',
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/bdd-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    storageState: 'e2e-bdd/.auth/user.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 1.4: Atualizar `fixtures.ts` com fixture `apiToken`**

```ts
// frontend/e2e-bdd/fixtures.ts
import { test as base } from 'playwright-bdd'
import * as fs from 'fs'
import * as path from 'path'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080'

function readApiToken(): string {
  const tokenPath = path.resolve('e2e-bdd/.auth/api-token.json')
  const { token } = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'))
  return token
}

export const test = base.extend<{
  apiToken: string
  apiUrl: string
}>({
  apiToken: async ({}, use) => {
    await use(readApiToken())
  },
  apiUrl: async ({}, use) => {
    await use(API_URL)
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 1.5: Verificar que `bddgen` ainda funciona**

```bash
cd frontend && npx bddgen --config=playwright.bdd.config.ts
```

Esperado: saída sem erros, pasta `.features-gen/` atualizada.

- [ ] **Step 1.6: Commit**

```bash
git add frontend/e2e-bdd/global-setup.ts \
        frontend/playwright.bdd.config.ts \
        frontend/.gitignore \
        frontend/e2e-bdd/fixtures.ts
git commit -m "test: setup globalSetup + storageState + apiToken fixture para BDD"
```

---

## Task 2: Imóveis — PropertiesPage + Feature + Steps

Domínio `property`. Frontend já usa Go API (`goFetch`). Página de listagem em `/properties`, formulário de criação em `/properties/new`.

**Contexto de seletores:**
- Listagem: `/properties` — cards com nome do imóvel visível
- Botão "Novo Imóvel": `page.getByRole('link', { name: /Novo Imóvel/ })`
- Campo nome: `page.getByLabel('Nome do Imóvel')`
- Select tipo (Shadcn/radix): clicar no `[role="combobox"]`, depois no `[role="option"]`
- Submit: `page.getByRole('button', { name: 'Criar Imóvel' })`
- Toast sucesso: `text=Imóvel criado com sucesso`
- Toast erro: `text=` com a mensagem de erro

**API para setup/teardown:**
- `POST /api/v1/properties` — body: `{ name, type }` — retorna `{ data: { id, name, type } }`
- `DELETE /api/v1/properties/:id`

**Files:**
- Create: `frontend/e2e-bdd/pages/PropertiesPage.ts`
- Create: `frontend/e2e-bdd/features/imoveis.feature`
- Create: `frontend/e2e-bdd/steps/imoveis.steps.ts`

- [ ] **Step 2.1: Escrever `imoveis.feature`**

```gherkin
# language: pt
# frontend/e2e-bdd/features/imoveis.feature
Funcionalidade: Gestão de Imóveis

  Contexto:
    Dado que estou autenticado

  @smoke
  Cenário: Listar imóveis existentes
    Dado que existe um imóvel "Imóvel Listagem BDD" do tipo "SINGLE" criado via API
    Quando navego para a lista de imóveis
    Então devo ver "Imóvel Listagem BDD" na lista

  @smoke
  Cenário: Criar imóvel do tipo SINGLE com sucesso
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E preencho o nome do imóvel com "Imóvel SINGLE BDD"
    E seleciono o tipo "SINGLE"
    E submeto o formulário de imóvel
    Então devo ver a confirmação de imóvel criado
    E devo ser redirecionado para a página do imóvel

  Cenário: Criar imóvel do tipo RESIDENTIAL com sucesso
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E preencho o nome do imóvel com "Imóvel RESIDENTIAL BDD"
    E seleciono o tipo "RESIDENTIAL"
    E submeto o formulário de imóvel
    Então devo ver a confirmação de imóvel criado

  Cenário: Não criar imóvel sem nome
    Quando navego para a lista de imóveis
    E clico em "Novo Imóvel"
    E submeto o formulário de imóvel sem preencher o nome
    Então o formulário não deve ser submetido

  Cenário: Excluir imóvel
    Dado que existe um imóvel "Imóvel Para Excluir BDD" do tipo "SINGLE" criado via API
    Quando navego para a página do imóvel "Imóvel Para Excluir BDD"
    E excluo o imóvel
    Então devo ser redirecionado para a lista de imóveis
    E "Imóvel Para Excluir BDD" não deve aparecer na lista
```

- [ ] **Step 2.2: Rodar `bddgen` e verificar stubs gerados**

```bash
cd frontend && npx bddgen --config=playwright.bdd.config.ts
```

Esperado: step definitions faltando listadas no terminal (isso é esperado — ainda não criamos os steps).

- [ ] **Step 2.3: Criar `PropertiesPage.ts`**

```ts
// frontend/e2e-bdd/pages/PropertiesPage.ts
import { Page, expect } from '@playwright/test'

export class PropertiesPage {
  constructor(private page: Page) {}

  async navegarParaLista() {
    await this.page.goto('/properties')
    await this.page.waitForLoadState('networkidle')
  }

  async clicarNovoImovel() {
    await this.page.getByRole('link', { name: /Novo Imóvel/ }).click()
    await this.page.waitForURL(/\/properties\/new/)
  }

  async preencherNome(nome: string) {
    await this.page.getByLabel('Nome do Imóvel').fill(nome)
  }

  async selecionarTipo(tipo: 'SINGLE' | 'RESIDENTIAL') {
    const labels = { SINGLE: 'Único (Casa/Loja)', RESIDENTIAL: 'Residencial (Prédio/Condomínio)' }
    await this.page.getByRole('combobox').click()
    await this.page.getByRole('option', { name: labels[tipo] }).click()
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Criar Imóvel' }).click()
  }

  async submeterFormularioSemNome() {
    await this.page.getByRole('button', { name: 'Criar Imóvel' }).click()
  }

  async verificarNaLista(nome: string) {
    await expect(this.page.getByText(nome)).toBeVisible()
  }

  async verificarAusenteNaLista(nome: string) {
    await expect(this.page.getByText(nome)).not.toBeVisible()
  }

  async verificarToastCriado() {
    await expect(this.page.getByText('Imóvel criado com sucesso')).toBeVisible()
  }

  async verificarRedirecionadoParaImovel() {
    await this.page.waitForURL(/\/properties\/[a-f0-9-]+/)
  }

  async verificarFormularioNaoSubmetido() {
    // Campo nome tem required — browser bloqueia submit sem valor
    expect(this.page.url()).toContain('/properties/new')
  }

  async navegarParaImovel(nome: string) {
    await this.page.goto('/properties')
    await this.page.waitForLoadState('networkidle')
    await this.page.getByText(nome).click()
    await this.page.waitForURL(/\/properties\/[a-f0-9-]+/)
  }

  async excluirImovel() {
    // Botão de exclusão na página de detalhe do imóvel
    await this.page.getByRole('button', { name: /[Ee]xcluir|[Dd]eletar|[Rr]emover/ }).click()
    // Confirmar no AlertDialog se houver
    const confirmar = this.page.getByRole('button', { name: /[Cc]onfirmar|[Ss]im/ })
    if (await confirmar.isVisible()) {
      await confirmar.click()
    }
  }
}
```

- [ ] **Step 2.4: Criar `imoveis.steps.ts`**

```ts
// frontend/e2e-bdd/steps/imoveis.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { PropertiesPage } from '../pages/PropertiesPage'

const { Given, When, Then, After } = createBdd(test)

let propertiesPage: PropertiesPage
const createdPropertyIds: string[] = []

Given('que estou autenticado', async ({ page }) => {
  // storageState já está configurado no playwright.bdd.config.ts — só verifica
  await page.goto('/')
  await expect(page).not.toHaveURL(/login/)
})

Given(
  'que existe um imóvel {string} do tipo {string} criado via API',
  async ({ request, apiToken, apiUrl }, nome: string, tipo: string) => {
    const res = await request.post(`${apiUrl}/api/v1/properties`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: nome, type: tipo },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    createdPropertyIds.push(data.id)
  },
)

When('navego para a lista de imóveis', async ({ page }) => {
  propertiesPage = new PropertiesPage(page)
  await propertiesPage.navegarParaLista()
})

When('clico em {string}', async ({}, _label: string) => {
  await propertiesPage.clicarNovoImovel()
})

When('preencho o nome do imóvel com {string}', async ({}, nome: string) => {
  await propertiesPage.preencherNome(nome)
})

When('seleciono o tipo {string}', async ({}, tipo: string) => {
  await propertiesPage.selecionarTipo(tipo as 'SINGLE' | 'RESIDENTIAL')
})

When('submeto o formulário de imóvel', async ({}) => {
  await propertiesPage.submeterFormulario()
})

When('submeto o formulário de imóvel sem preencher o nome', async ({}) => {
  await propertiesPage.submeterFormularioSemNome()
})

When('navego para a página do imóvel {string}', async ({ page }, nome: string) => {
  propertiesPage = new PropertiesPage(page)
  await propertiesPage.navegarParaImovel(nome)
})

When('excluo o imóvel', async ({}) => {
  await propertiesPage.excluirImovel()
})

Then('devo ver {string} na lista', async ({}, nome: string) => {
  await propertiesPage.verificarNaLista(nome)
})

Then('devo ver a confirmação de imóvel criado', async ({}) => {
  await propertiesPage.verificarToastCriado()
})

Then('devo ser redirecionado para a página do imóvel', async ({}) => {
  await propertiesPage.verificarRedirecionadoParaImovel()
})

Then('o formulário não deve ser submetido', async ({}) => {
  await propertiesPage.verificarFormularioNaoSubmetido()
})

Then('devo ser redirecionado para a lista de imóveis', async ({ page }) => {
  await page.waitForURL(/\/properties$/)
})

Then('{string} não deve aparecer na lista', async ({}, nome: string) => {
  await propertiesPage.verificarAusenteNaLista(nome)
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of createdPropertyIds) {
    await request.delete(`${apiUrl}/api/v1/properties/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  createdPropertyIds.length = 0
})
```

- [ ] **Step 2.5: Rodar `bddgen` novamente e verificar que steps foram reconhecidos**

```bash
cd frontend && npx bddgen --config=playwright.bdd.config.ts
```

Esperado: sem "unmatched steps" — todos os steps de `imoveis.feature` têm implementação.

- [ ] **Step 2.6: Rodar os testes de imóveis (requer `make up`)**

```bash
cd frontend && npx playwright test --config=playwright.bdd.config.ts --grep "@smoke" 2>&1 | tail -20
```

Esperado: 2 cenários `@smoke` PASS (ou FAIL com mensagem específica de seletor, ajustar no POM se necessário).

- [ ] **Step 2.7: Commit**

```bash
git add frontend/e2e-bdd/pages/PropertiesPage.ts \
        frontend/e2e-bdd/features/imoveis.feature \
        frontend/e2e-bdd/steps/imoveis.steps.ts
git commit -m "test(e2e): cenários BDD de imóveis com Page Object e setup via API"
```

---

## Task 3: Inquilinos — TenantsPage + Feature + Steps

Domínio `tenant`. Frontend usa Go API. Listagem em `/tenants` (tabela), formulário em Dialog "Novo Inquilino".

**Contexto de seletores:**
- Botão "Novo Inquilino": `page.getByRole('button', { name: /Novo Inquilino/ })`
- Dialog abre com título "Novo Inquilino"
- Nome: `page.getByLabel('Nome Completo')` (ou `input[name="name"]`)
- Email: `page.getByLabel('Email')` (ou `input[name="email"]`)
- Submit: `page.getByRole('button', { name: 'Cadastrar Inquilino' })`
- Linha na tabela: `page.getByRole('cell', { name })`
- Botão desativar: ícone `XCircle` com `title="Desativar"`

**API para setup/teardown:**
- `POST /api/v1/tenants` — body: `{ name, person_type: 'PF' }` — retorna `{ data: { id } }`
- `DELETE /api/v1/tenants/:id`

**Files:**
- Create: `frontend/e2e-bdd/pages/TenantsPage.ts`
- Create: `frontend/e2e-bdd/features/inquilinos.feature`
- Create: `frontend/e2e-bdd/steps/inquilinos.steps.ts`

- [ ] **Step 3.1: Escrever `inquilinos.feature`**

```gherkin
# language: pt
# frontend/e2e-bdd/features/inquilinos.feature
Funcionalidade: Gestão de Inquilinos

  Contexto:
    Dado que estou na página de inquilinos

  @smoke
  Cenário: Listar inquilinos existentes
    Dado que existe um inquilino "Inquilino Listagem BDD" criado via API
    Então devo ver "Inquilino Listagem BDD" na tabela de inquilinos

  @smoke
  Cenário: Cadastrar novo inquilino com sucesso
    Quando clico em "Novo Inquilino"
    E preencho o nome do inquilino com "Inquilino Novo BDD"
    E preencho o email do inquilino com "bdd@example.com"
    E submeto o formulário de inquilino
    Então devo ver a confirmação de inquilino cadastrado
    E devo ver "Inquilino Novo BDD" na tabela de inquilinos

  Cenário: Não cadastrar inquilino sem nome
    Quando clico em "Novo Inquilino"
    E submeto o formulário de inquilino sem preencher o nome
    Então o dialog de inquilino deve permanecer aberto

  Cenário: Desativar inquilino
    Dado que existe um inquilino "Inquilino Para Desativar BDD" criado via API
    Quando desativo o inquilino "Inquilino Para Desativar BDD"
    Então devo ver a confirmação de status alterado
```

- [ ] **Step 3.2: Criar `TenantsPage.ts`**

```ts
// frontend/e2e-bdd/pages/TenantsPage.ts
import { Page, expect } from '@playwright/test'

export class TenantsPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/tenants')
    await this.page.waitForLoadState('networkidle')
  }

  async clicarNovoInquilino() {
    await this.page.getByRole('button', { name: /Novo Inquilino/ }).click()
    await expect(this.page.getByText('Novo Inquilino').last()).toBeVisible()
  }

  async preencherNome(nome: string) {
    await this.page.getByLabel('Nome Completo').fill(nome)
  }

  async preencherEmail(email: string) {
    await this.page.getByLabel('Email').fill(email)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Cadastrar Inquilino' }).click()
  }

  async submeterSemNome() {
    await this.page.getByRole('button', { name: 'Cadastrar Inquilino' }).click()
  }

  async verificarNaTabela(nome: string) {
    await expect(this.page.getByRole('cell', { name: nome })).toBeVisible()
  }

  async verificarToastCadastrado() {
    await expect(this.page.getByText('Inquilino cadastrado com sucesso')).toBeVisible()
  }

  async verificarToastStatusAlterado() {
    await expect(
      this.page.getByText(/desativado|ativado/i),
    ).toBeVisible()
  }

  async verificarDialogAberto() {
    await expect(this.page.getByRole('dialog')).toBeVisible()
  }

  async desativarInquilino(nome: string) {
    const row = this.page.getByRole('row', { name: new RegExp(nome) })
    await row.getByTitle('Desativar').click()
  }
}
```

- [ ] **Step 3.3: Criar `inquilinos.steps.ts`**

```ts
// frontend/e2e-bdd/steps/inquilinos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { TenantsPage } from '../pages/TenantsPage'

const { Given, When, Then, After } = createBdd(test)

let tenantsPage: TenantsPage
const createdTenantIds: string[] = []

Given('que estou na página de inquilinos', async ({ page }) => {
  tenantsPage = new TenantsPage(page)
  await tenantsPage.navegar()
})

Given(
  'que existe um inquilino {string} criado via API',
  async ({ request, apiToken, apiUrl }, nome: string) => {
    const res = await request.post(`${apiUrl}/api/v1/tenants`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: nome, person_type: 'PF' },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    createdTenantIds.push(data.id)
  },
)

When('clico em {string}', async ({}, _label: string) => {
  await tenantsPage.clicarNovoInquilino()
})

When('preencho o nome do inquilino com {string}', async ({}, nome: string) => {
  await tenantsPage.preencherNome(nome)
})

When('preencho o email do inquilino com {string}', async ({}, email: string) => {
  await tenantsPage.preencherEmail(email)
})

When('submeto o formulário de inquilino', async ({}) => {
  await tenantsPage.submeterFormulario()
})

When('submeto o formulário de inquilino sem preencher o nome', async ({}) => {
  await tenantsPage.submeterSemNome()
})

When('desativo o inquilino {string}', async ({}, nome: string) => {
  await tenantsPage.desativarInquilino(nome)
})

Then('devo ver {string} na tabela de inquilinos', async ({}, nome: string) => {
  await tenantsPage.verificarNaTabela(nome)
})

Then('devo ver a confirmação de inquilino cadastrado', async ({}) => {
  await tenantsPage.verificarToastCadastrado()
})

Then('o dialog de inquilino deve permanecer aberto', async ({}) => {
  await tenantsPage.verificarDialogAberto()
})

Then('devo ver a confirmação de status alterado', async ({}) => {
  await tenantsPage.verificarToastStatusAlterado()
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of createdTenantIds) {
    await request.delete(`${apiUrl}/api/v1/tenants/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  createdTenantIds.length = 0
})
```

- [ ] **Step 3.4: Rodar testes de inquilinos**

```bash
cd frontend && npx playwright test --config=playwright.bdd.config.ts --grep "Inquilinos" 2>&1 | tail -20
```

Esperado: cenários PASS ou FAIL com mensagem de seletor específico (ajustar POM se necessário).

- [ ] **Step 3.5: Commit**

```bash
git add frontend/e2e-bdd/pages/TenantsPage.ts \
        frontend/e2e-bdd/features/inquilinos.feature \
        frontend/e2e-bdd/steps/inquilinos.steps.ts
git commit -m "test(e2e): cenários BDD de inquilinos com Page Object e setup via API"
```

---

## Task 4: Contratos — LeasesPage + Feature + Steps

Domínio `lease`. Frontend usa Go API. Listagem em `/leases`, formulário em Dialog "Novo Contrato". Requer property+unit+tenant existentes para criar um contrato.

**Contexto de seletores:**
- Botão "Novo Contrato": `page.getByRole('button', { name: /Novo Contrato/ })`
- Select de unidade: `page.locator('select[name="unit_id"]')` (Shadcn Select com name)
- Select de inquilino: `page.locator('select[name="tenant_id"]')`
- Data de início: `input[name="start_date"]`
- Valor do aluguel: `input[name="rent_amount"]`
- Dia de pagamento: `input[name="payment_day"]`
- Submit: `page.getByRole('button', { name: 'Criar Contrato' })`
- Status ACTIVE: badge com texto "Ativo"

**API para setup/teardown:**
- `POST /api/v1/properties` → `{ data: { id } }` (type: SINGLE cria unidade automática)
- `GET /api/v1/properties/:id` → `{ data: { units: [{ id }] } }`
- `POST /api/v1/tenants` → `{ data: { id } }`
- `POST /api/v1/leases` → `{ data: { id } }`
- `DELETE /api/v1/leases/:id`, `DELETE /api/v1/tenants/:id`, `DELETE /api/v1/properties/:id`

**Files:**
- Create: `frontend/e2e-bdd/pages/LeasesPage.ts`
- Create: `frontend/e2e-bdd/features/contratos.feature`
- Create: `frontend/e2e-bdd/steps/contratos.steps.ts`

- [ ] **Step 4.1: Escrever `contratos.feature`**

```gherkin
# language: pt
# frontend/e2e-bdd/features/contratos.feature
Funcionalidade: Gestão de Contratos

  Contexto:
    Dado que estou na página de contratos

  @smoke
  Cenário: Listar contratos ativos
    Dado que existe um contrato ativo criado via API
    Então devo ver pelo menos um contrato na lista

  @smoke
  Cenário: Criar novo contrato com sucesso
    Dado que existe um imóvel com unidade disponível criado via API para contrato
    E que existe um inquilino disponível criado via API para contrato
    Quando clico em "Novo Contrato"
    E seleciono a unidade disponível no formulário de contrato
    E seleciono o inquilino disponível no formulário de contrato
    E preencho a data de início com "2026-06-01"
    E preencho o valor do aluguel com "1500"
    E preencho o dia de pagamento com "5"
    E submeto o formulário de contrato
    Então devo ver a confirmação de contrato criado

  Cenário: Encerrar contrato
    Dado que existe um contrato ativo criado via API
    Quando encerro o contrato ativo
    Então devo ver a confirmação de contrato encerrado
```

- [ ] **Step 4.2: Criar `LeasesPage.ts`**

```ts
// frontend/e2e-bdd/pages/LeasesPage.ts
import { Page, expect } from '@playwright/test'

export class LeasesPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/leases')
    await this.page.waitForLoadState('networkidle')
  }

  async clicarNovoContrato() {
    await this.page.getByRole('button', { name: /Novo Contrato/ }).click()
    await expect(this.page.getByText('Novo Contrato de Locação')).toBeVisible()
  }

  async selecionarUnidade(unitId: string) {
    await this.page.locator('select[name="unit_id"]').selectOption(unitId)
  }

  async selecionarInquilino(tenantId: string) {
    await this.page.locator('select[name="tenant_id"]').selectOption(tenantId)
  }

  async preencherDataInicio(data: string) {
    await this.page.fill('input[name="start_date"]', data)
  }

  async preencherValorAluguel(valor: string) {
    await this.page.fill('input[name="rent_amount"]', valor)
  }

  async preencherDiaPagamento(dia: string) {
    await this.page.fill('input[name="payment_day"]', dia)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Criar Contrato' }).click()
  }

  async verificarPeloMenosUmContrato() {
    const rows = this.page.locator('table tbody tr')
    await expect(rows).not.toHaveCount(0)
  }

  async verificarToastCriado() {
    await expect(this.page.getByText(/contrato criado|criado com sucesso/i)).toBeVisible()
  }

  async encerrarPrimeiroContrato() {
    // Clicar no botão de encerrar/editar do primeiro contrato da lista
    await this.page.locator('button[aria-label*="Encerrar"], button[title*="Encerrar"]').first().click()
    const confirmar = this.page.getByRole('button', { name: /[Cc]onfirmar|[Ss]im|[Ee]ncerrar/ })
    if (await confirmar.isVisible()) {
      await confirmar.click()
    }
  }

  async verificarToastEncerrado() {
    await expect(this.page.getByText(/encerrado|finalizado/i)).toBeVisible()
  }
}
```

- [ ] **Step 4.3: Criar `contratos.steps.ts`**

```ts
// frontend/e2e-bdd/steps/contratos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { LeasesPage } from '../pages/LeasesPage'

const { Given, When, Then, After } = createBdd(test)

let leasesPage: LeasesPage
let availableUnitId = ''
let availableTenantId = ''
const toDelete = { leaseIds: [] as string[], tenantIds: [] as string[], propertyIds: [] as string[] }

async function createPropertyWithUnit(
  request: Parameters<Parameters<typeof Given>[1]>[0]['request'],
  apiToken: string,
  apiUrl: string,
): Promise<{ propertyId: string; unitId: string }> {
  const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Prop BDD ${Date.now()}`, type: 'SINGLE' },
  })
  expect(propRes.ok()).toBeTruthy()
  const { data: prop } = await propRes.json()

  const detailRes = await request.get(`${apiUrl}/api/v1/properties/${prop.id}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  const { data: propDetail } = await detailRes.json()
  return { propertyId: prop.id, unitId: propDetail.units[0].id }
}

Given('que estou na página de contratos', async ({ page }) => {
  leasesPage = new LeasesPage(page)
  await leasesPage.navegar()
})

Given('que existe um contrato ativo criado via API', async ({ request, apiToken, apiUrl }) => {
  const { propertyId, unitId } = await createPropertyWithUnit(request, apiToken, apiUrl)
  toDelete.propertyIds.push(propertyId)

  const tenantRes = await request.post(`${apiUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Inquilino BDD ${Date.now()}`, person_type: 'PF' },
  })
  expect(tenantRes.ok()).toBeTruthy()
  const { data: tenant } = await tenantRes.json()
  toDelete.tenantIds.push(tenant.id)

  const leaseRes = await request.post(`${apiUrl}/api/v1/leases`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      unit_id: unitId,
      tenant_id: tenant.id,
      start_date: '2026-01-01T00:00:00Z',
      rent_amount: 1000,
      payment_day: 5,
    },
  })
  expect(leaseRes.ok()).toBeTruthy()
  const { data: lease } = await leaseRes.json()
  toDelete.leaseIds.push(lease.id)
})

Given(
  'que existe um imóvel com unidade disponível criado via API para contrato',
  async ({ request, apiToken, apiUrl }) => {
    const { propertyId, unitId } = await createPropertyWithUnit(request, apiToken, apiUrl)
    toDelete.propertyIds.push(propertyId)
    availableUnitId = unitId
  },
)

Given(
  'que existe um inquilino disponível criado via API para contrato',
  async ({ request, apiToken, apiUrl }) => {
    const res = await request.post(`${apiUrl}/api/v1/tenants`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { name: `Inquilino Contrato BDD ${Date.now()}`, person_type: 'PF' },
    })
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    toDelete.tenantIds.push(data.id)
    availableTenantId = data.id
  },
)

When('clico em {string}', async ({}, _label: string) => {
  await leasesPage.clicarNovoContrato()
})

When('seleciono a unidade disponível no formulário de contrato', async ({}) => {
  await leasesPage.selecionarUnidade(availableUnitId)
})

When('seleciono o inquilino disponível no formulário de contrato', async ({}) => {
  await leasesPage.selecionarInquilino(availableTenantId)
})

When('preencho a data de início com {string}', async ({}, data: string) => {
  await leasesPage.preencherDataInicio(data)
})

When('preencho o valor do aluguel com {string}', async ({}, valor: string) => {
  await leasesPage.preencherValorAluguel(valor)
})

When('preencho o dia de pagamento com {string}', async ({}, dia: string) => {
  await leasesPage.preencherDiaPagamento(dia)
})

When('submeto o formulário de contrato', async ({}) => {
  await leasesPage.submeterFormulario()
})

When('encerro o contrato ativo', async ({}) => {
  await leasesPage.encerrarPrimeiroContrato()
})

Then('devo ver pelo menos um contrato na lista', async ({}) => {
  await leasesPage.verificarPeloMenosUmContrato()
})

Then('devo ver a confirmação de contrato criado', async ({}) => {
  await leasesPage.verificarToastCriado()
})

Then('devo ver a confirmação de contrato encerrado', async ({}) => {
  await leasesPage.verificarToastEncerrado()
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of toDelete.leaseIds) {
    await request.delete(`${apiUrl}/api/v1/leases/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.tenantIds) {
    await request.delete(`${apiUrl}/api/v1/tenants/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.propertyIds) {
    await request.delete(`${apiUrl}/api/v1/properties/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  toDelete.leaseIds.length = 0
  toDelete.tenantIds.length = 0
  toDelete.propertyIds.length = 0
})
```

- [ ] **Step 4.4: Rodar testes de contratos**

```bash
cd frontend && npx playwright test --config=playwright.bdd.config.ts --grep "Contratos" 2>&1 | tail -20
```

- [ ] **Step 4.5: Commit**

```bash
git add frontend/e2e-bdd/pages/LeasesPage.ts \
        frontend/e2e-bdd/features/contratos.feature \
        frontend/e2e-bdd/steps/contratos.steps.ts
git commit -m "test(e2e): cenários BDD de contratos com Page Object e setup via API"
```

---

## Task 5: Pagamentos — PaymentsPage + Feature + Steps

Domínio `payment`. Frontend usa Go API. Listagem em `/payments`, formulário em Dialog "Novo Pagamento".

**Contexto de seletores:**
- Botão "Novo Pagamento": `page.getByRole('button', { name: /Novo Pagamento/ })`
- Select contrato: `select[name="lease_id"]`
- Select tipo: `select[name="type"]`
- Descrição: `input[name="description"]` ou `textarea[name="description"]`
- Valor: `input[name="gross_amount"]`
- Vencimento: `input[name="due_date"]`
- Submit: `page.getByRole('button', { name: 'Salvar' })`

**API para setup/teardown:**
- Chain completa: property → unit (auto) → tenant → lease → payment (via `POST /api/v1/leases/:id/payments`)
- `PUT /api/v1/payments/:id` — body: `{ status: 'PAID', gross_amount, paid_date }` — marcar como pago

**Files:**
- Create: `frontend/e2e-bdd/pages/PaymentsPage.ts`
- Create: `frontend/e2e-bdd/features/pagamentos.feature`
- Create: `frontend/e2e-bdd/steps/pagamentos.steps.ts`

- [ ] **Step 5.1: Escrever `pagamentos.feature`**

```gherkin
# language: pt
# frontend/e2e-bdd/features/pagamentos.feature
Funcionalidade: Gestão de Pagamentos

  Contexto:
    Dado que estou na página de pagamentos

  @smoke
  Cenário: Listar pagamentos existentes
    Dado que existe um pagamento pendente criado via API
    Então devo ver pelo menos um pagamento na lista

  @smoke
  Cenário: Registrar pagamento manualmente
    Dado que existe um contrato ativo disponível para pagamento criado via API
    Quando clico em "Novo Pagamento"
    E seleciono o contrato disponível no formulário de pagamento
    E seleciono o tipo "RENT"
    E preencho o valor do pagamento com "1200"
    E preencho o vencimento com "2026-07-01"
    E submeto o formulário de pagamento
    Então devo ver a confirmação de pagamento registrado

  Cenário: Marcar pagamento como pago via API
    Dado que existe um pagamento pendente criado via API
    Quando marco o pagamento como pago via API
    Então o pagamento deve ter status PAID
```

- [ ] **Step 5.2: Criar `PaymentsPage.ts`**

```ts
// frontend/e2e-bdd/pages/PaymentsPage.ts
import { Page, expect } from '@playwright/test'

export class PaymentsPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/payments')
    await this.page.waitForLoadState('networkidle')
  }

  async clicarNovoPagamento() {
    await this.page.getByRole('button', { name: /Novo Pagamento/ }).click()
    await expect(this.page.getByText('Registrar Pagamento')).toBeVisible()
  }

  async selecionarContrato(leaseId: string) {
    await this.page.locator('select[name="lease_id"]').selectOption(leaseId)
  }

  async selecionarTipo(tipo: string) {
    await this.page.locator('select[name="type"]').selectOption(tipo)
  }

  async preencherValor(valor: string) {
    await this.page.fill('input[name="gross_amount"]', valor)
  }

  async preencherVencimento(data: string) {
    await this.page.fill('input[name="due_date"]', data)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Salvar' }).click()
  }

  async verificarPeloMenosUmPagamento() {
    const rows = this.page.locator('table tbody tr, [data-testid="payment-item"]')
    await expect(rows).not.toHaveCount(0)
  }

  async verificarToastRegistrado() {
    await expect(this.page.getByText(/pagamento registrado|criado com sucesso/i)).toBeVisible()
  }
}
```

- [ ] **Step 5.3: Criar `pagamentos.steps.ts`**

```ts
// frontend/e2e-bdd/steps/pagamentos.steps.ts
import { createBdd } from 'playwright-bdd'
import { test, expect } from '../fixtures'
import { PaymentsPage } from '../pages/PaymentsPage'

const { Given, When, Then, After } = createBdd(test)

let paymentsPage: PaymentsPage
let availableLeaseId = ''
let createdPaymentId = ''
const toDelete = { paymentIds: [] as string[], leaseIds: [] as string[], tenantIds: [] as string[], propertyIds: [] as string[] }

async function createFullChain(
  request: Parameters<Parameters<typeof Given>[1]>[0]['request'],
  apiToken: string,
  apiUrl: string,
) {
  const propRes = await request.post(`${apiUrl}/api/v1/properties`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Prop Pag BDD ${Date.now()}`, type: 'SINGLE' },
  })
  const { data: prop } = await propRes.json()
  toDelete.propertyIds.push(prop.id)

  const propDetail = await request.get(`${apiUrl}/api/v1/properties/${prop.id}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  const { data: detail } = await propDetail.json()
  const unitId = detail.units[0].id

  const tenantRes = await request.post(`${apiUrl}/api/v1/tenants`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: { name: `Inq Pag BDD ${Date.now()}`, person_type: 'PF' },
  })
  const { data: tenant } = await tenantRes.json()
  toDelete.tenantIds.push(tenant.id)

  const leaseRes = await request.post(`${apiUrl}/api/v1/leases`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      unit_id: unitId,
      tenant_id: tenant.id,
      start_date: '2026-01-01T00:00:00Z',
      rent_amount: 1200,
      payment_day: 5,
    },
  })
  const { data: lease } = await leaseRes.json()
  toDelete.leaseIds.push(lease.id)

  return { leaseId: lease.id }
}

Given('que estou na página de pagamentos', async ({ page }) => {
  paymentsPage = new PaymentsPage(page)
  await paymentsPage.navegar()
})

Given('que existe um pagamento pendente criado via API', async ({ request, apiToken, apiUrl }) => {
  const { leaseId } = await createFullChain(request, apiToken, apiUrl)

  const payRes = await request.post(`${apiUrl}/api/v1/leases/${leaseId}/payments`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      due_date: '2026-07-01T00:00:00Z',
      gross_amount: 1200,
      type: 'RENT',
    },
  })
  expect(payRes.ok()).toBeTruthy()
  const { data: payment } = await payRes.json()
  toDelete.paymentIds.push(payment.id)
  createdPaymentId = payment.id
})

Given(
  'que existe um contrato ativo disponível para pagamento criado via API',
  async ({ request, apiToken, apiUrl }) => {
    const { leaseId } = await createFullChain(request, apiToken, apiUrl)
    availableLeaseId = leaseId
  },
)

When('clico em {string}', async ({}, _label: string) => {
  await paymentsPage.clicarNovoPagamento()
})

When('seleciono o contrato disponível no formulário de pagamento', async ({}) => {
  await paymentsPage.selecionarContrato(availableLeaseId)
})

When('seleciono o tipo {string}', async ({}, tipo: string) => {
  await paymentsPage.selecionarTipo(tipo)
})

When('preencho o valor do pagamento com {string}', async ({}, valor: string) => {
  await paymentsPage.preencherValor(valor)
})

When('preencho o vencimento com {string}', async ({}, data: string) => {
  await paymentsPage.preencherVencimento(data)
})

When('submeto o formulário de pagamento', async ({}) => {
  await paymentsPage.submeterFormulario()
})

When('marco o pagamento como pago via API', async ({ request, apiToken, apiUrl }) => {
  const res = await request.put(`${apiUrl}/api/v1/payments/${createdPaymentId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    data: {
      status: 'PAID',
      gross_amount: 1200,
      paid_date: new Date().toISOString(),
    },
  })
  expect(res.ok()).toBeTruthy()
})

Then('devo ver pelo menos um pagamento na lista', async ({}) => {
  await paymentsPage.verificarPeloMenosUmPagamento()
})

Then('devo ver a confirmação de pagamento registrado', async ({}) => {
  await paymentsPage.verificarToastRegistrado()
})

Then('o pagamento deve ter status PAID', async ({ request, apiToken, apiUrl }) => {
  const res = await request.get(`${apiUrl}/api/v1/payments/${createdPaymentId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  const { data } = await res.json()
  expect(data.status).toBe('PAID')
})

After(async ({ request, apiToken, apiUrl }) => {
  for (const id of toDelete.leaseIds) {
    await request.delete(`${apiUrl}/api/v1/leases/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.tenantIds) {
    await request.delete(`${apiUrl}/api/v1/tenants/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  for (const id of toDelete.propertyIds) {
    await request.delete(`${apiUrl}/api/v1/properties/${id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
  }
  toDelete.leaseIds.length = 0
  toDelete.tenantIds.length = 0
  toDelete.propertyIds.length = 0
  toDelete.paymentIds.length = 0
  createdPaymentId = ''
})
```

- [ ] **Step 5.4: Rodar todos os testes BDD**

```bash
cd frontend && npx playwright test --config=playwright.bdd.config.ts 2>&1 | tail -30
```

Esperado: todos os cenários PASS ou mensagens específicas de seletor a ajustar.

- [ ] **Step 5.5: Commit final**

```bash
git add frontend/e2e-bdd/pages/PaymentsPage.ts \
        frontend/e2e-bdd/features/pagamentos.feature \
        frontend/e2e-bdd/steps/pagamentos.steps.ts
git commit -m "test(e2e): cenários BDD de pagamentos com Page Object e setup via API"
```

---

## Notas de Implementação

### Steps com mesmo texto em domínios diferentes

O `playwright-bdd` registra steps globalmente. Steps com exatamente o mesmo texto (ex: `clico em {string}`) em múltiplos arquivos causarão conflito. Há duas formas de resolver:

**Opção A (preferida):** Tornar o step mais específico em cada arquivo:
- `clico em "Novo Imóvel"` → step em `imoveis.steps.ts`
- `clico em "Novo Inquilino"` → step em `inquilinos.steps.ts`

**Opção B:** Usar [fixtures de step](https://github.com/vitalets/playwright-bdd#fixtures) para isolar por feature.

Se houver conflito ao rodar `bddgen`, renomear os steps para incluir o domínio (ex: `clico em novo imóvel`, `clico em novo inquilino`).

### Seletores Shadcn Select

O `PropertyForm` usa Shadcn/Radix Select (não native). Se `getByRole('combobox')` não funcionar, alternativas:
```ts
await page.locator('[data-slot="select-trigger"]').click()
await page.locator('[data-slot="select-item"]:has-text("Único")').click()
```

### LeaseForm Select de Unidade/Inquilino

O `LeaseForm` usa `<Select name="unit_id">` (Shadcn). Se `selectOption` no locator nativo falhar, usar:
```ts
await page.locator('[name="unit_id"]').locator('..').click()
await page.getByRole('option', { name: /unidade/i }).first().click()
```

### Variáveis de Ambiente

Criar `frontend/.env.test.local` (gitignored):
```env
E2E_USER_EMAIL=owner@example.com
E2E_USER_PASSWORD=senha123
E2E_API_URL=http://localhost:8080
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Rodar com Docker

```bash
# Stack deve estar rodando
make up

# Rodar testes BDD (de fora do container, apontando para localhost)
cd frontend && npm run test:bdd

# Ou dentro do container
docker compose exec frontend npm run test:bdd
```
