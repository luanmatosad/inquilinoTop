# Design

## Context

- `frontend/src/app/globals.css` já tem tokens semânticos shadcn em `:root`/`[data-theme="light"]`, `.dark`/`[data-theme="dark"]` e `@theme inline`. Tailwind v4 com `@import "shadcn/tailwind.css"`.
- Figma (node 5984:59776) via MCP: `get_variable_defs` retorna um conjunto de valores por nó, sem seleção de modo. Consultas em `16536:518` (Feature 01) e `10446:312` (Cover) retornaram os mesmos valores light. O modo Dark não é acessível pelo MCP com os parâmetros atuais.
- Cores light principais já coincidem com o Figma (background, foreground, primary, secondary, muted, border, success). Divergências: `input` (Figma `#fefefc`, código `#8f8f96`), `text-xs`, sombras e opacidade não existem no CSS.
- Regra do projeto: `frontend/src/components/ui/` não é modificado. Mudança de aparência só via tokens.
- `project/ds/imoviflow/tokens.json` não existe; referência removida de `globals.css`.

## Goals / Non-Goals

**Goals:**
- Um único arquivo (`globals.css`) como fonte de tokens consumida pelo Tailwind.
- Valores light e dark alinhados ao Figma.
- Tipografia, espaçamento, radius e sombra disponíveis como utilitários.

**Non-Goals:**
- Pipeline Figma → JSON → Style Dictionary (opção B, descartada).
- Gerador automático ou sincronização com Figma em CI.
- Alterar componentes `components/ui/` ou telas além do impacto dos tokens.
- Ajustar a paleta de primitivas (slate, purple, lime…) como utilitários; ficam fora se nenhum componente as usa.

## Decisions

1. **globals.css como fonte única.** Sem gerador. Alternativa (Style Dictionary) foi recusada: adiciona dependência e pipeline sem segundo consumidor.
2. **Figma é a verdade, com uma exceção: `--input` = `#8f8f96`.** O token `input` no Figma será alterado para o mesmo valor, manualmente. Motivo: `#fefefc` falha WCAG 1.4.11 (1.01:1).
3. **`text-xs` = 14px.** Decisão do usuário. Substitui 12px do Figma `Typography/Font Size/text-xs`.
4. **Tokens de extensão marcados.** `accent`, `destructive`, `warning`, `ring`, `chart-*`, `sidebar-*` ficam no CSS com comentário "fora do Figma" até uma leitura de Figma confirmar ou remover.
5. **Sombra como `--shadow-xs` e `--shadow-base`** em `@theme inline`, valor em `box-shadow` com duas camadas para base.
6. **Opacidade em fração.** Figma `50` → `0.5`.
7. **Nomes normalizados.** `Gap/0,5` → `0.5`, etc.
8. **Dark pendente de fonte.** Valores dark atuais de `globals.css` são mantidos até o usuário fornecer um frame em modo Dark (node-id) ou exportar os valores. Não inventar valores dark.

## Risks / Trade-offs

- **Divergência Figma × código em `input`** até o token ser alterado no Figma. Enquanto isso, o Figma mostra contraste 1.01:1. Mitigação: task 1.2 é pré-requisito do archive.
- **Contraste medido (WCAG 1.4.11):** `#8f8f96` = 3.21:1 sobre `#ffffff`, 3.18:1 sobre `#fefefc`, 5.52:1 sobre `#18181b`, 4.82:1 sobre `#242427`. Todos ≥ 3:1.
- **Dark sem validação contra Figma.** Os valores dark atuais foram escritos à mão. Risco de divergência até task 1.1 ser concluída.
- **Mudança visual em `text-xs`** (12 → 14px) afeta labels e legendas em todas as telas. Revisar telas densas (tabelas, badges).
- **Sombras e opacidade** não foram comparadas visualmente com o Figma. Risco de pequena diferença de render.
