# Design: Testes E2E com Playwright BDD

**Data:** 2026-05-12  
**Branch:** feat/playwright-bdd-e2e  
**Escopo:** Cobertura BDD (Gherkin) dos domínios imóveis, inquilinos, contratos e pagamentos

---

## Contexto

O frontend usa Next.js 16 App Router com Supabase como legado e Go backend como destino de migração. O Playwright já está instalado (`@playwright/test` ^1.48.0, `playwright-bdd` ^8.5.1) com dois configs existentes:

- `playwright.config.ts` — testes e2e padrão em `e2e/`
- `playwright.bdd.config.ts` — testes BDD em `e2e-bdd/`

Já existem: `e2e-bdd/features/autenticacao.feature`, `e2e-bdd/steps/autenticacao.steps.ts`, `e2e-bdd/fixtures.ts`.

---

## Objetivo

Expandir a suíte BDD com cobertura dos fluxos CRUD para os quatro domínios principais do produto: imóveis (+ unidades), inquilinos, contratos e pagamentos.

---

## Abordagem Escolhida

**Page Objects + `storageState` + dados criados via API**

- Page Objects por domínio encapsulam seletores e ações
- Autenticação feita uma vez via `globalSetup`, sessão salva em `.auth/user.json`
- Steps criam e limpam dados de teste via chamadas diretas à API Go

---

## Estrutura de Arquivos

```
frontend/e2e-bdd/
  features/
    autenticacao.feature      ← existente
    imoveis.feature           ← novo
    inquilinos.feature        ← novo
    contratos.feature         ← novo
    pagamentos.feature        ← novo
  steps/
    autenticacao.steps.ts     ← existente
    imoveis.steps.ts          ← novo
    inquilinos.steps.ts       ← novo
    contratos.steps.ts        ← novo
    pagamentos.steps.ts       ← novo
  pages/                      ← novo (diretório)
    PropertiesPage.ts
    TenantsPage.ts
    LeasesPage.ts
    PaymentsPage.ts
  fixtures.ts                 ← expandir com storageState + globalSetup

frontend/.auth/
  user.json                   ← storageState gerado (gitignored)
```

---

## Autenticação

Um `globalSetup` em `fixtures.ts` (ou arquivo dedicado `global-setup.ts`) executa antes de toda a suíte:

1. Faz `POST /api/v1/auth/login` com credenciais de um usuário de teste fixo (variável de ambiente `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`)
2. Salva o estado de autenticação (cookies e/ou localStorage) em `.auth/user.json`

O `playwright.bdd.config.ts` referencia:
```ts
use: {
  storageState: '.auth/user.json',
}
```

Nenhum cenário BDD realiza login pela UI — isso é responsabilidade exclusiva de `autenticacao.feature`.

`.auth/user.json` e `.auth/` são adicionados ao `.gitignore`.

---

## Dados de Teste

Cada `steps.ts` é responsável por criar e destruir seus próprios dados:

- **`Given` (pré-condição):** chama a API Go via `request` fixture do Playwright para criar entidades necessárias (ex: criar um imóvel antes de testar a listagem de unidades)
- **`After` / `AfterAll`:** deleta as entidades criadas via `DELETE` na API, garantindo isolamento entre cenários

Exemplo de padrão:
```ts
Given('que existe um imóvel cadastrado', async ({ request }) => {
  const res = await request.post('/api/v1/properties', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Apto Teste', type: 'RESIDENTIAL' },
  })
  propertyId = (await res.json()).data.id
})

AfterAll(async ({ request }) => {
  await request.delete(`/api/v1/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
})
```

---

## Page Objects

Cada `XxxPage.ts` expõe métodos semânticos em vez de seletores raw:

```ts
// pages/PropertiesPage.ts
export class PropertiesPage {
  constructor(private page: Page) {}

  async navegarParaLista() {
    await this.page.goto('/properties')
  }

  async criar(dados: { nome: string; tipo: 'RESIDENTIAL' | 'SINGLE' }) {
    await this.page.click('[data-testid="btn-novo-imovel"]')
    await this.page.fill('[name="name"]', dados.nome)
    await this.page.selectOption('[name="type"]', dados.tipo)
    await this.page.click('[type="submit"]')
  }

  async verificarNaLista(nome: string) {
    await expect(this.page.getByText(nome)).toBeVisible()
  }

  async editar(nome: string, novosDados: Partial<{ nome: string }>) { ... }

  async excluir(nome: string) { ... }
}
```

Steps instanciam o Page Object via fixture:
```ts
Given('que estou na página de imóveis', async ({ page }) => {
  propertiesPage = new PropertiesPage(page)
  await propertiesPage.navegarParaLista()
})
```

---

## Cenários por Domínio

Cada `.feature` cobre o CRUD básico em português (Gherkin com `language: pt`):

### imoveis.feature
- Listar imóveis existentes
- Criar imóvel residencial (RESIDENTIAL) com sucesso
- Criar imóvel individual (SINGLE) — verifica criação automática de unidade "Unidade 01"
- Tentar criar imóvel com dados inválidos (campo nome vazio)
- Editar nome de um imóvel
- Excluir imóvel (soft-delete — não aparece mais na lista)

### inquilinos.feature
- Listar inquilinos
- Cadastrar novo inquilino com sucesso
- Tentar cadastrar com CPF/email duplicado
- Editar dados de inquilino
- Desativar inquilino

### contratos.feature
- Listar contratos ativos
- Criar contrato vinculando inquilino a uma unidade
- Encerrar contrato (status → ENDED)
- Verificar que unidade associada fica disponível após encerramento

### pagamentos.feature
- Listar pagamentos pendentes
- Marcar pagamento como pago
- Verificar que pagamento em atraso aparece com status LATE
- Registrar pagamento avulso

---

## Convenções

- Linguagem dos `.feature`: português (`# language: pt`)
- Linguagem dos `.steps.ts` e `.pages/`: TypeScript com comentários mínimos
- Seletores preferidos: `data-testid` > `aria-label` > texto visível > CSS selector
- Cada domínio tem seu próprio arquivo de feature, steps e page object — sem mistura
- Steps compartilháveis (ex: navegação genérica) vão em `fixtures.ts`, não duplicados por arquivo

---

## O que está fora do escopo desta branch

- Testes mobile (config existe mas não será prioridade)
- Integração Playwright no CI/CD (Makefile/Docker) — branch separada futura
- Domínios sem frontend ativo: `fiscal`, `audit`, `ratelimit`, `notification`, `document`
- Testes de performance ou acessibilidade

---

## Variáveis de Ambiente Necessárias

```env
# .env.test.local (não commitado)
E2E_USER_EMAIL=owner@example.com
E2E_USER_PASSWORD=senha123
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Critérios de Sucesso

- `npm run test:bdd` executa sem erros com stack local rodando (`make up`)
- Cada domínio tem ao menos 4 cenários cobrindo: listar, criar (válido), criar (inválido), e uma operação de mutação (editar ou excluir)
- Nenhum cenário depende de estado deixado por outro cenário
- `.auth/user.json` está no `.gitignore`
