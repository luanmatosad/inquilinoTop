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
