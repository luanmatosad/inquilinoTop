# 0002 - shadcn/ui como única biblioteca de UI

**Status**: Accepted

## Context

O frontend conviveu com duas bibliotecas de componentes: HeroUI v3 (telas antigas) e shadcn/ui (`src/components/ui/`). Manter as duas duplicava padrões, aumentava o bundle e deixava dúvida sobre qual usar em tela nova. A migração para shadcn/ui foi concluída (change `migrate-shadcn-ui-kit`, arquivada em 2026-10-17) e `@heroui/*` saiu de `package.json` e `src/`, mas sobravam referências em docs e changes abertas, e nada impedia a volta da dependência.

## Decision

shadcn/ui (Radix + Tailwind v4) é a única biblioteca de componentes. Componentes faltantes entram via CLI do shadcn em `src/components/ui/`, sem escrever do zero e sem importar de outra biblioteca. Um `no-restricted-imports` em `frontend/eslint.config.mjs` bloqueia imports de `@heroui/*` no `make frontend-lint`.

Alternativa rejeitada: manter HeroUI nas telas legadas. Custo de manter duas bibliotecas sem ganho, e as telas já foram migradas.

## Consequences

- Telas novas usam só `src/components/ui/`; ícones continuam em lucide-react.
- Reintroduzir outra biblioteca de UI exige novo ADR que substitua este.
- Mocks do Stitch em `docs/frontend/` são histórico visual; a menção à biblioteca foi trocada, o layout não.
