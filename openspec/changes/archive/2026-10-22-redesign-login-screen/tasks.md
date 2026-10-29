## 1. Assets

- [x] 1.1 Baixar `Photo1`, `Photo2` e `Vector` (blob) do Figma via `curl -L` e salvar em `frontend/public/login/`
- [x] 1.2 Baixar/criar ícone Google (`frontend/public/icons/google.svg`)
- [x] 1.3 Otimizar imagens baixadas (WebP/AVIF conforme padrão do projeto) se aplicável

## 2. Componentes

- [x] 2.1 Criar `src/components/auth/BrandPanel.tsx` (imagem + blob + headline "Menos planilhas. Mais controle.")
- [x] 2.2 Criar `src/components/auth/LoginForm.tsx` com prop `mode: 'login' | 'signup'`, reaproveitando `Label`/`InputGroup*`/`Button` do Shadcn
- [x] 2.3 Implementar botão Google desabilitado com ícone + texto "Entrar com a conta Google"
- [x] 2.4 Implementar divisor "Ou" entre o botão Google e os campos de formulário
- [x] 2.5 Implementar campo de senha com alternância mostrar/ocultar (reusar `Eye`/`EyeOff` de `lucide-react`)
- [x] 2.6 Implementar botão outline "Não possui conta? Cadastra-se" linkando para `/login?mode=signup` (e inverso "Já tem conta? Entrar" no modo signup)

## 3. Página

- [x] 3.1 Reescrever `src/app/login/page.tsx` para montar o grid split-screen com `BrandPanel` + `LoginForm`
- [x] 3.2 Ler `mode` de `searchParams` e repassar para `LoginForm`
- [x] 3.3 Garantir responsividade: painel de marca oculto abaixo de `md`, formulário com padding adequado em mobile
- [x] 3.4 Remover o toggle de tabs Entrar/Cadastrar da implementação antiga
- [x] 3.5 (descoberto na implementação) Suprimir Header/Sidebar global em `/login` via `AppShell.tsx`, já que o `RootLayout` aplicava chrome a todas as rotas e quebrava o layout full-bleed
- [x] 3.6 (correção, revertida em 3.7) Substituir a composição em camadas por `herobanner.png` flatten — abandonado por não escalar bem em monitores largos/baixos (crop cortava o headline/rodapé) e perder nitidez acima de 756px de largura exibida
- [x] 3.7 (correção final) Fundo + blob via assets separados do Figma (re-exportados em 3x via Figma MCP `download_assets`, 2268px), headline como texto HTML real (`clamp()`) em vez de baked-in — nunca corta, nunca borra, reflow natural em qualquer monitor. Corrigidos no processo: `next.config.ts` faltava `images.qualities`/`dangerouslyAllowSVG` (Next 16 bloqueia quality/SVG fora da allowlist, 400 silencioso); o export "flatten" do node do blob via Figma API vinha com retângulo de fundo opaco cobrindo tudo — trocado pelo `svgAssets` (shape isolado); descartado `photo1` (export do node aninhado saía com canvas branco opaco em vez de alpha) e reaproveitado `photo2` como única foto

## 4. Validação

- [x] 4.1 Testar login com credenciais válidas e inválidas (Go API real via `make up`) — signup/login redirecionam para `/`, credenciais inválidas mostram "credenciais inválidas" inline
- [x] 4.2 Testar fluxo de cadastro via `/login?mode=signup` — conta criada e logada com sucesso
- [x] 4.3 Testar alternância de visibilidade de senha — type password↔text confirmado
- [x] 4.4 Testar responsividade em mobile e desktop no navegador — validado em 390 (mobile), 767/768 (boundary do `md`), 820×1180, 768×1024, 1024×768 (tablets), 1280×720, 1280×800, 1366×768 (laptops), 1440×900, 1920×1080, 2560×1080 (ultrawide): sem crop indevido, sem perda de nitidez, sem erros de console
- [x] 4.5 Rodar `make frontend-lint` — sem erros novos nos arquivos tocados (7 erros pré-existentes em outros módulos, não relacionados)
- [x] 4.6 Checar se existem testes/E2E cobrindo `/login` e atualizar se necessário — nenhum teste existente cobre `/login`, nada a atualizar
