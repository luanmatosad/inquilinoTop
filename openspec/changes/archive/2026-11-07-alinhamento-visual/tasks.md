## 1. Fonte

- [x] 1.1 Teste do layout raiz: as variáveis de fonte estão no `<html>` e o `<body>` tem `font-sans`
- [x] 1.2 Mover as classes de variável para o `<html>` e aplicar `font-sans` no `<body>` em `layout.tsx`
- [x] 1.3 Conferir no navegador (`localhost:3000`) que `getComputedStyle(html).fontFamily` e `body` começam por Urbanist e que `font-mono` usa Space Mono; olhar sidebar, tabelas e cards por quebras de largura

## 2. Campos e botão

- [x] 2.1 Testes de classes: `Input` e `Select` (gatilho) com `h-11 md:h-9`; `Textarea` com raio e sombra; `Button` padrão com `h-11 md:h-8`; raio e sombra do canvas
- [x] 2.2 Ajustar `input.tsx`, `select.tsx`, `textarea.tsx` e `button.tsx`
- [x] 2.3 Remover as classes de altura avulsas (`h-11`, `h-9`, `h-10`) que as telas puseram em campos e botões, conferindo cada uso

## 3. Card, tabela e painel

- [x] 3.1 Testes de classes: `Card` (cabeçalho com padding 16 e gap 4, título 16/24 600, variante `size="flush"`), `Table` (cabeçalho 12px/500 em `muted`, células 12×16, linha com 56px) e `Sheet` lateral (440 e padding 24)
- [x] 3.2 Ajustar `card.tsx`, `table.tsx` e `sheet.tsx` (e `dialog.tsx` onde divergir)
- [x] 3.3 Remover as compensações nas telas (`p-0 gap-0`, `h-16` em linhas, `sm:max-w-[440px]`, `p-4` em `Card`), trocando por `size="flush"` quando for o caso
- [x] 3.4 Rodar a suíte Vitest e `make frontend-lint`; corrigir os testes que dependiam das classes antigas

## 4. Passada de comparação

- [x] 4.1 Abrir cada artboard (casca, Imóveis, Inquilinos, Contratos, Recebimentos, Despesas, cobrança e recibo) e a tela correspondente em 1440 e 390 de largura; registrar as diferenças na tabela do `design.md`
- [x] 4.2 Corrigir as diferenças que couberem aqui; registrar as demais como pendência da onda da seção
- [x] 4.3 Conferir as telas antigas que usam os componentes ajustados (Hoje, Configurações, Suporte, Laudos, Importar) por quebras visuais

## 5. Documentação

- [x] 5.1 Atualizar `.claude/rules/design-system.md` (o canvas manda; o `shadcnds` é referência de estrutura e diverge no raio e no anel) e `frontend/CLAUDE.md` com as medidas do canvas
- [x] 5.2 Suíte Vitest e `make frontend-lint` verdes
