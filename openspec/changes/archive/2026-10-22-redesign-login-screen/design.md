## Context

A tela `/login` atual (`frontend/src/app/login/page.tsx`) é um client component único que alterna entre "Entrar" e "Cadastrar" via tabs dentro do mesmo `Card`, usando `useActionState` com as Server Actions `login`/`signup` de `src/app/auth/actions.ts` (já migradas para a Go API via `src/lib/go/client.ts`).

O novo design (Figma node `98:3134`) é um layout split-screen: formulário de login à esquerda, painel de marca (foto + headline + blob vetorial) à direita. Os tokens de cor do design (`--primary: #4f46e5`, `--foreground: #171717`, `--muted-foreground: #6b6c67`, `--border: #e5e5e5`, `--input: #fefefc`) já existem em `frontend/src/app/globals.css` — não é necessário criar/alterar tokens.

O projeto já usa Shadcn/UI (`Button`, `Card`, `Label`, `InputGroup*`) e os component descriptions do Figma apontam para os mesmos componentes Shadcn (`button`, `input-group`, `label`, `field`), então a tradução design→código é direta.

## Goals / Non-Goals

**Goals:**
- Implementar o layout split-screen do Figma em `/login`, responsivo (painel de marca oculto abaixo de `md`).
- Reusar os componentes Shadcn (`Button`, `Label`, `InputGroup*`) já presentes no projeto em vez de recriar inputs.
- Extrair o formulário de login para um componente dedicado (`src/components/auth/LoginForm.tsx`) separando layout de lógica.
- Baixar e versionar os assets de imagem do Figma localmente (fotos + vetor de fundo).
- Preparar a UI para login social Google (botão visível) sem implementar OAuth no backend.

**Non-Goals:**
- Implementar o fluxo OAuth Google no backend (`identity`) — botão fica desabilitado/`disabled` com tooltip "Em breve" até existir suporte.
- Criar a página `/signup` completa com o novo visual — este change só troca o CTA de `/login` para linkar para `/signup`; o redesign de `/signup` fica como change futuro. Até lá, `/signup` mantém a implementação atual (tabs) OU redireciona para o mesmo componente com `mode=signup` — decisão abaixo.
- Alterar o comportamento de autenticação (cookies, refresh, middleware).

## Decisions

**1. Separar cadastro em rota própria vs. manter estado na mesma página**
Decisão: manter cadastro acessível via `/login?mode=signup` (query param), reaproveitando o mesmo client component, em vez de criar fisicamente `/signup` agora.
Alternativas: (a) nova rota `/signup` dedicada — mais fiel ao Figma (botão "Não possui conta? Cadastra-se" sugere navegação), mas exige duplicar o painel de marca; (b) manter tabs iguais ao atual — rejeitado, conflita com o Figma que não tem tabs.
Razão: `?mode=signup` evita duplicar o split-screen/painel de marca e mantém uma única fonte de verdade para o layout, com custo baixo de implementação. O botão de cadastro aponta para essa query string.

**2. Componentização**
`page.tsx` fica fino: monta o grid split-screen (`<BrandPanel />` + `<LoginForm />`). `LoginForm` recebe `mode: 'login' | 'signup'` lido de `searchParams` e renderiza os campos condicionalmente (nome completo só no signup), preservando a lógica de `useActionState` já existente.

**3. Botão Google**
Renderizado sempre, com `disabled` e `aria-disabled` até o backend suportar OAuth. Não adicionar lógica de autenticação fake. Ícone Google baixado como asset estático (`public/icons/google.svg`), não via `lucide-react` (não tem glyph de marca).

**4. Assets de imagem**
Baixar `imgPhoto1`, `imgPhoto2` (fotos) e `imgVector` (blob de fundo) do Figma via `curl -L` para `frontend/public/login/` e referenciar com caminho relativo — nunca usar as URLs temporárias `figma.com/api/mcp/asset/...` (expiram em ~7 dias).

**5. Ícone de olho (mostrar/ocultar senha)**
Manter `Eye`/`EyeOff` de `lucide-react`, já usado na implementação atual — o Figma usa Phosphor, mas o projeto já padroniza em `lucide-react`; não introduzir nova lib de ícones por uma tela.

## Risks / Trade-offs

- [Botão Google visível mas não funcional pode confundir usuário] → Mitigar com `disabled` visual (opacidade reduzida) e, se necessário, tooltip "Em breve".
- [`?mode=signup` diverge do Figma, que sugere navegação para tela própria] → Aceitável como passo intermediário; revisar quando `/signup` ganhar design próprio.
- [Assets de imagem grandes (`Photo1`/`Photo2`) podem pesar no bundle] → Usar `next/image` com `priority` apenas na imagem acima da dobra e `sizes` adequado; considerar compressão/format AVIF/WebP ao baixar.
- [Mudança de layout quebra testes/E2E existentes que dependem da estrutura de tabs, se houver] → Checar `frontend` por testes do `/login` antes de remover tabs.

## Migration Plan

1. Baixar assets do Figma para `frontend/public/login/`.
2. Criar `src/components/auth/BrandPanel.tsx` e `src/components/auth/LoginForm.tsx`.
3. Reescrever `src/app/login/page.tsx` para usar os dois componentes, lendo `mode` de `searchParams`.
4. Validar manualmente login e cadastro (`make up` + fluxo real) nos dois modos e em mobile/desktop.
5. Sem rollback de dados — é mudança puramente de UI; revert via `git revert` se necessário.

## Implementation Notes

- O `RootLayout` (`src/app/layout.tsx`) renderizava `<Header />` (com `Sidebar`) e o wrapper `<main className="md:ml-64 pt-16"><div className="p-4 md:p-8">` incondicionalmente para toda rota, inclusive `/login` — isso quebrava o layout full-bleed split-screen do Figma (header fixo sobrepondo o painel de marca, margem de sidebar e padding cortando a borda da imagem). Não estava mapeado no proposal/Impact original.
- Correção aplicada: extraída a decisão de chrome (header + sidebar + wrapper) para `src/components/AppShell.tsx` (client component, `usePathname()`), que suprime `Header`/`main` wrapper quando a rota começa com `/login`, mantendo children sem alterações para as demais rotas. `Header` continua Server Component, passado como prop/children para `AppShell`.

## Open Questions

- Login social Google entra no roadmap do backend `identity` em breve, ou o botão deve ficar oculto em vez de desabilitado até lá?
- `/signup` dedicado (rota própria com split-screen replicado) é um change futuro aceito, ou preferem já criar a rota física nesta mudança?
