# Design System — Figma ↔ shadcnds ↔ Frontend

Carrega em toda sessão que toca `frontend/`. Fonte única de verdade pra UI: repo [`shadcnds`](https://github.com/luanmatosad/shadcnds) (local: `~/Documents/muudawork/imoviflow/shadcnds`), espelhando o Figma **UI Kit ImoviFlow — Shandnc**.

## Regra de ouro

**Nunca criar componente de UI do zero dentro de `frontend/src/components/`.** Toda tela nova construída a partir do Figma reusa componente existente — fielmente, sem reestilizar ad hoc.

## Fluxo obrigatório pra implementar uma tela do Figma

1. Identificar o node/componente no Figma (ex: Button, Card, Select).
2. Consultar `shadcnds/docs/figma-mapping.md` — tabela node-id → arquivo do componente.
3. Componente já existe em `frontend/src/components/ui/<nome>.tsx`? Usar direto, só compor props/variants — não editar classes base.
4. Não existe, ou a versão do `shadcnds` está mais nova? Copiar o arquivo de `shadcnds/src/components/ui/<nome>.tsx` pra `frontend/src/components/ui/<nome>.tsx`, ajustando:
   - `import { cn } from "cn"` → `import { cn } from "@/lib/utils"` (inquilinoTop usa `cn` próprio via clsx+tailwind-merge, não o pacote `cn`)
   - imports de outros componentes `ui/*` já devem bater (mesmo alias `@/components/ui`)
5. Componente do Figma não existe nem como stock shadcn nem no `shadcnds` ainda? Construir **lá primeiro** (seguindo `shadcnds/CLAUDE.md`), atualizar `docs/figma-mapping.md`, só depois copiar pra cá. Nunca direto em `frontend/`.

## Diferença de preset (atenção ao copiar)

- `shadcnds`: preset **Nova**, base **Radix UI**, `components.json` com `"style": "radix-nova"`.
- `inquilinoTop/frontend`: style **new-york** (CLI mais antigo), `components.json` com `"style": "new-york"`.

Ambos Radix por baixo — classes Tailwind costumam ser compatíveis, mas **sempre visualmente confirma no browser após copiar** (pode haver diferença sutil de padding/radius entre presets). Se abrir disparidade grande, ajustar manualmente mantendo os tokens do `globals.css` do inquilinoTop (não importar o `globals.css` do shadcnds).

## Nunca fazer

- Reimplementar um Button/Card/Select customizado dentro de uma feature (`src/components/<módulo>/`) quando já existe em `components/ui/`.
- Copiar um componente do `shadcnds` e já sair alterando a estrutura/classes base na mesma tarefa — primeiro copia fiel, depois (se precisar) ajuste é commit separado e documentado.
- Instalar componente shadcn direto no `frontend` via `npx shadcn add` sem primeiro checar se o `shadcnds` já tem (evita duas fontes de verdade divergindo).
