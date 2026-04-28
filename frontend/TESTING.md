# Frontend Testing Guide

InquilinoTop frontend usa **Vitest** para testes unitários e **Playwright** para testes E2E.

## Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

## Testes Unitários (Vitest + React Testing Library)

### Rodar testes

```bash
npm run test              # Modo watch
npm run test:ui          # UI interativa
npm run test:coverage    # Com coverage report
```

### Estrutura

- Testes em `src/__tests__/**/*.test.tsx`
- Arquivo setup: `vitest.setup.ts`
- Config: `vitest.config.ts`

### Exemplo

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles click', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

## Testes E2E (Playwright)

### Rodar testes

```bash
npm run test:e2e         # Modo headless
npm run test:e2e:ui      # UI interativa
npm run test:e2e -- --debug  # Modo debug
```

### Estrutura

- Testes em `e2e/**/*.spec.ts`
- Config: `playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

### Exemplo

```typescript
import { test, expect } from '@playwright/test'

test('should login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"]', 'user@example.com')
  await page.fill('input[type="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
  expect(page.url()).toBe('http://localhost:3000/')
})
```

## Rodando Tudo

```bash
npm run test:all  # lint + unit tests + E2E tests
```

## Cidades

Todos os testes devem passar antes do merge:

- [ ] ESLint (`npm run lint`)
- [ ] Unit tests (`npm run test`)
- [ ] E2E tests (`npm run test:e2e`)

## Cobertura de Testes

Objetivo: **70%+ cobertura** no código de produção

```bash
npm run test:coverage
# Abre: coverage/index.html
```

## GitHub Actions

CI/CD automaticamente:
1. Roda `npm run lint`
2. Roda `npm run test`
3. Roda `npm run test:e2e`

Se qualquer falhar, o PR é bloqueado.

## Áreas Críticas para Teste

Prioridade:
1. **Auth Flow** — login, logout, refresh token
2. **Forms** — criação de propriedades, contratos, pagamentos
3. **Data Display** — listas, filtros, paginação
4. **API Integration** — chamadas para Go backend

## Tips

- Use `getByRole` em preferência a `getByTestId` (mais resiliente)
- Use `screen.findBy*` para async (espera até aparecer)
- Use `user.setup()` do `@testing-library/user-event` para interactions realistas
- Mock APIs em testes unitários, não em E2E
- Use `test.beforeEach` para setup comum
- Mantenha testes isolados (sem interdependências)

## Debugging

### Playwright

```bash
npm run test:e2e -- --debug
# Abre Playwright Inspector
```

```typescript
// No seu teste
await page.pause()  // Pausa e abre inspector
```

### Vitest

```bash
npm run test:ui
# UI interativa para explorar testes
```

## CI/CD Integration

O GitHub Actions roda todos os testes automaticamente. Veja `.github/workflows/ci.yml`.

## Mais Informações

- [Vitest Docs](https://vitest.dev)
- [React Testing Library Docs](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev)
