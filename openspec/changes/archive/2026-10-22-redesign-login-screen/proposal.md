## Why

A tela atual de `/login` (`frontend/src/app/login/page.tsx`) é um card genérico Shadcn com tabs "Entrar/Cadastrar" — não reflete a identidade visual da ImoviFlow, não oferece login social e usa um layout centralizado estreito que desperdiça espaço em telas grandes. Foi produzido um novo design no Figma ([node 98:3134](https://www.figma.com/design/DTnya7kIISa8RWDgqTWsux/ImoveFlow?node-id=98-3134)) que resolve isso com um layout split-screen (formulário + imagem/mensagem de marca), login via Google e um fluxo de autenticação simplificado (sem tabs — login e cadastro como páginas/estados distintos).

## What Changes

- Substituir o layout atual de `/login` por um layout split-screen: formulário à esquerda, painel de marca (imagem + headline "Menos planilhas. Mais controle.") à direita em telas `md+`; em mobile, apenas o formulário.
- Adicionar botão "Entrar com a conta Google" acima do formulário de e-mail/senha, com divisor "Ou".
- Remover o toggle de tabs Entrar/Cadastrar do card; o CTA de cadastro vira um botão outline abaixo do form ("Não possui conta? Cadastra-se") levando para `/signup` (ou estado equivalente) — **BREAKING**: remove o fluxo de cadastro inline na mesma página.
- Ajustar campos de e-mail/senha ao novo visual (inputs com placeholder dentro do campo, ícone de olho para mostrar/ocultar senha mantido).
- Manter o fluxo de autenticação com a Go API (`src/lib/go/client.ts`) — login social Google fica como capacidade exposta na UI; a integração OAuth real com o backend fica fora de escopo desta mudança (botão desabilitado/placeholder até o backend suportar, ver Impact).

## Capabilities

### New Capabilities
- `login-screen`: Layout, estrutura visual e estados (padrão, loading, erro) da tela de login — split-screen com painel de marca e formulário de credenciais.

### Modified Capabilities
_Nenhuma — não há spec existente para login/auth; o comportamento de autenticação em si (chamada à Go API, cookies, refresh) não muda, só a UI._

## Impact

- **Código**: `frontend/src/app/login/page.tsx` (reescrita de layout), possivelmente novo componente `src/components/auth/LoginForm.tsx` para separar a UI do split-screen.
- **Assets**: baixar e versionar os assets do Figma (fotos e vetor de fundo) em `frontend/public/` ou `src/assets/` — não usar as URLs temporárias do Figma (expiram em 7 dias).
- **Rotas**: fluxo de cadastro passa a precisar de rota própria (`/signup`) caso ainda não exista — avaliar durante o design.
- **Backend**: login social Google requer suporte OAuth no `identity` (Go) — fora de escopo; botão entra como UI preparada, não funcional, até backend suportar (a confirmar em design.md).
- **Sem mudança** em `src/lib/go/client.ts`, middleware de auth, ou endpoints existentes de login/signup por e-mail+senha.
