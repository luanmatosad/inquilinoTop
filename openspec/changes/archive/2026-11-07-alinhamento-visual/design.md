## Context

Evidência colhida no app em execução (`localhost:3000/login`):

- `getComputedStyle(html).fontFamily` e `getComputedStyle(body).fontFamily` valem `ui-sans-serif, system-ui, …`. A Urbanist aparece em `document.fonts` como carregada, mas nenhum elemento a usa.
- O CSS compilado define `--default-font-family: var(--font-urbanist)`, usado por `html { font-family: … }`. A variável `--font-urbanist` só existe no `<body>` (classe gerada por `next/font`), então no `<html>` ela é inválida e o navegador volta à fonte do sistema.

Kit de componentes: `ui/*` vem do preset `new-york` (botão `rounded-md`, `shadow-xs`; card com borda, `py-6`, `gap-6`), mas `sheet.tsx` e trechos de outros arquivos usam o estilo Nova (`data-open:`, `bg-clip-padding`). O repositório `shadcnds` (preset Nova) usa `rounded-lg` e anel `ring-1` em vez de borda e sombra, o que **não** bate com o CSS das artboards.

Medidas lidas do CSS das artboards do canvas (fonte da verdade):

| Elemento | Canvas | App hoje |
|---|---|---|
| Texto base | Urbanist 14px/1.4 | fonte do sistema |
| Título da página | 24px/600, linha 1.2 | igual (ajustado por tela) |
| Botão | altura 32, raio 6, 14px/500, gap 8; celular 44 | altura 32, raio 6 (ok) |
| Input / Select | altura 36, raio 6, `shadow-xs`; celular 44 | altura 32 |
| Card | raio 12, borda, `shadow-sm`; cabeçalho com 16px de padding e gap 4; título 16/24 600 | `py-6 gap-6` (telas usam `p-4`/`p-0 gap-0`) |
| KPI | padding 16, rótulo 14/500, valor 28/36 600 | refeito por tela |
| Selo (`badge`) | altura 20, pílula, 12px/500, ponto de 6px | ok, ponto feito por tela |
| Chip | altura 28 (celular 32), pílula, 13px/500 | feito por tela |
| Tabela | cabeçalho 12px/500 em fundo `muted`, células 12×16, linha mínima 56 | `h-16` por tela |
| Sheet | largura 440, padding 24, gap 16 | `sm:max-w-[440px]` por tela |

## Goals / Non-Goals

**Goals:** a fonte do canvas em todo o app; componentes base com as medidas do canvas, de modo que as telas dispensem as classes de compensação; uma lista objetiva das diferenças restantes nas telas já feitas.

**Non-Goals:** redesenhar telas antigas; adotar o preset Nova; criar componentes novos fora do que as artboards usam.

## Decisions

**1. Fonte nas duas pontas.** As classes `urbanist.variable` e `spaceMono.variable` passam para o `<html>`, e o `<body>` ganha `font-sans`. Assim `--font-urbanist` existe onde o Tailwind resolve o `font-family`. Teste: renderizar o layout e conferir as classes; e, na verificação, a família computada no navegador.

**2. O alvo é o CSS do canvas, não o `shadcnds`.** A regra do projeto manda copiar do `shadcnds`, mas o preset Nova dele diverge do canvas (raio 8px, anel em vez de borda). Os componentes `new-york` do app já estão perto. Portanto os arquivos `ui/*` são ajustados no lugar para as medidas da tabela acima, e cada ajuste é documentado no `frontend/CLAUDE.md` e na regra `design-system.md` (que passa a dizer que o canvas manda e o `shadcnds` é só referência de estrutura). Alternativa descartada: substituir o kit pelo do `shadcnds`, que traria o visual Nova e quebraria as telas que já seguem o canvas.

**3. Altura por breakpoint, não por tela.** `Input`, `Select` e `Textarea` ganham 44px abaixo de `md` e 36px a partir dele, porque as artboards de celular usam 44px para toque. Botões idem (`h-11 md:h-8`). Assim os `className="h-11 w-full"` avulsos nas telas saem.

**4. Remover compensações só depois de ajustar o componente.** Para cada componente: ajustar o arquivo, rodar a suíte, procurar usos com classe de compensação (`grep` por `p-0 gap-0`, `sm:max-w-[440px]`, `h-16`, `h-11`) e removê-los. Telas antigas que dependem do padrão anterior (`Card` com `py-6`) são conferidas na passada de comparação.

**5. Passada de comparação.** Para cada tela já feita, abrir a artboard e a tela lado a lado nos mesmos tamanhos (1440 e 390 de largura), registrar as diferenças numa tabela no `design.md` (tela, elemento, canvas, app, correção) e corrigir as que couberem aqui. As que não couberem (dependem de dado ou de componente novo) ficam registradas como pendências, com a onda onde entram.

## Risks / Trade-offs

- [Mudar `Card`, `Input` e `Table` afeta as telas antigas] → conferir as telas antigas na passada, ajustar só o que quebrar e registrar o restante como dívida visual.
- [A fonte nova muda a métrica do texto e pode quebrar larguras fixas] → conferir sidebar, tabelas e cards no desktop e no celular.
- [Divergência entre `shadcnds` e canvas confunde quem seguir a regra antiga] → atualizar `design-system.md` e `frontend/CLAUDE.md` na mesma change.
- [Sem as artboards renderizadas a comparação visual depende do navegador do usuário] → onde eu não conseguir abrir a artboard, comparar pelas medidas numéricas da tabela e deixar a conferência visual final com o usuário.

## Open Questions

- Pílulas e selos têm variantes no canvas (por exemplo, o selo com ponto colorido) que hoje cada tela monta; extrair um `StatusBadge` único fica para a passada, se a repetição justificar.

## Resultado da passada de comparação

Método: as artboards ficam no claude.ai (sessão do usuário) e não abrem de forma automática; a comparação foi feita medindo no navegador (`getComputedStyle` e `getBoundingClientRect`, desktop 1680 de largura) as telas reais contra as medidas do CSS das artboards da tabela acima. A conferência visual lado a lado, e o celular (390), ficam com o usuário.

| Tela | Elemento | Canvas | App antes | Decisão |
|---|---|---|---|---|
| Todas | Fonte | Urbanist | fonte do sistema | Corrigido (variáveis no `<html>`) |
| Todas | Título da página | 24px, linha 1,2 (28,8px) | linha 30px (`leading-tight`) | Corrigido (`leading-[1.2]`, 11 arquivos) |
| Casca | Item do menu | raio 8 | raio 4 | Corrigido (`rounded-lg` em `Sidebar.tsx`) |
| Todas | Selo | altura 20 | 22 | Corrigido (`h-5`, sem `py-0.5`) |
| Todas | Campo e busca | 36px | 32px | Corrigido (`Input` e `Select`) |
| Recebimentos | Chip | 28px, 13px/500 | 32px, 14px | Corrigido (`md:h-7`, `text-[13px]`; 32px no celular) |
| Contratos, Recebimentos, Imóveis | Moldura, KPI, cabeçalho e linha da tabela, botão | conforme a tabela | já conforme | Sem diferença |
| Hoje, Configurações | Cartões, campos, títulos | (telas antigas, outro layout) | renderizam sem quebra com os componentes novos | Só conferidas; redesenho na onda da seção |

Pendências para o usuário conferir lado a lado: Despesas, Inquilinos, detalhe da cobrança, recibo e todas as telas no celular.
