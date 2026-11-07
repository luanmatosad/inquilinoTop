## Why

O app não parece o canvas "ImoviFlow — Telas". A causa mais visível é um bug: o texto usa a fonte do sistema (`ui-sans-serif, system-ui`) em vez da Urbanist, porque as variáveis de fonte são definidas no `<body>` e o `font-family` padrão do Tailwind é resolvido no `<html>`. A spec `design-tokens` já exige Urbanist ("a família computada começa por Urbanist"), então isso é um defeito de implementação das ondas anteriores, que conferiram tokens e cores mas nunca compararam a tela com a artboard. Além disso, os componentes base (`ui/*`) são um híbrido do preset `new-york` com trechos do preset Nova, não têm as medidas do canvas (por exemplo, `Input` e `Select` com 32px, e o canvas usa 36px) e cada tela compensa com classes avulsas (`p-0 gap-0` em `Card`, `sm:max-w-[440px]` em `Sheet`, `h-16` em linhas de tabela).

## What Changes

- Corrigir a fonte: as variáveis `--font-urbanist` e `--font-space-mono` passam para o `<html>` e o corpo usa `font-sans`; um teste garante que a família computada começa por Urbanist.
- Alinhar os componentes base às medidas do canvas (documentadas no design): `Input`, `Select` e `Textarea` (36px, 44px no celular), `Card` (cabeçalho com 16px de padding, raio 12), `Table` (cabeçalho e linhas), `Sheet` (largura 440 e padding 24) e `Dialog`, `Badge` e `Chip`. Onde as telas já compensavam com classes avulsas, remover a compensação.
- Passada de comparação com o canvas nas telas já refeitas (casca, Imóveis, Inquilinos, Contratos, Recebimentos, Despesas, detalhe da cobrança e recibo), no desktop e no celular, com a lista de diferenças e as correções.
- Fora desta etapa: redesenhar as telas antigas (Hoje, Configurações, Suporte, Laudos, Importar e os stubs do financeiro), que entram junto com a onda de cada seção; trocar o kit para o `shadcnds` (preset Nova), porque ele diverge do CSS do canvas.

## Capabilities

### New Capabilities
- `ui-primitives`: medidas dos componentes base do app, derivadas do CSS das artboards do canvas.

### Modified Capabilities
- `design-tokens`: a tipografia passa a ser verificada no `<html>` e no `<body>` (família computada e fonte realmente carregada).

## Impact

- Frontend: `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/{input,select,textarea,card,table,sheet,dialog,badge}.tsx`, remoção de classes de compensação em `components/{leases,financial,tenants,properties}/*` e nas páginas já refeitas, testes.
- Risco de regressão visual nas telas antigas que usam os mesmos componentes; mitigado pela passada de comparação e pelos testes de classes dos componentes.
- Sem mudança de backend.
