# Fiscal — Fases Pendentes

Fases extraídas do plano master `docs/superpowers/plans/2026-04-20-financeiro-nucleo-fiscal.md` para execução em batch por fase. Cada arquivo contém o conteúdo original daquela fase; as regras de arquitetura/teste/API valem (ver `.claude/rules/*.md`).

## Status

| Fase | Arquivo | Tasks | Status |
|---|---|---|---|
| 0 | (no master plan) | 1–5 (migrations) | ✅ Concluída |
| 1 | (no master plan) | 6–8 (tenant person_type) | ✅ Concluída |
| 2 | `fase-2-lease-fiscal.md` | 9–13 (lease fiscal fields + reajuste) | ⏳ Pendente |
| 3 | `fase-3-payment-estrutura.md` | 14–15 (payment model + repo) | ⏳ Pendente |
| 4 | `fase-4-fiscal-irrf.md` | 16 (fiscal module + IRRFTable) | ⏳ Pendente |
| 5 | `fase-5-payment-service.md` | 17–19 (Enrich, GenerateMonth, handler) | ⏳ Pendente |
| 6 | `fase-6-fiscal-annual-report.md` | 20–21 (AnnualReport + handler) | ⏳ Pendente |
| 7 | `fase-7-wireup-integracao-docs.md` | 22–24 (main.go + E2E + docs) | ⏳ Pendente |

## Execução

Cada fase é executada por **um único implementer** (subagent), produzindo um commit por task dentro da fase. Após cada fase: build limpo + testes da suite impactada passando.

Sequência obrigatória: 2 → 3 → 4 → 5 → 6 → 7. Dependências cruzadas documentadas no plano master.

## Gotchas globais (validos para todas as fases)

- **Monetários**: `FLOAT8` + `math.Round(x*100)/100` para arredondar a 2 casas (tech-debt; schema é FLOAT8).
- **Idempotência de migrations**: já aplicadas em 000009–000013, não adicionar novas.
- **Build**: pacote `payment` ainda não compila após migration 000011 (rename `amount → gross_amount`) — será corrigido na Fase 3.
- **`swag init`**: o binário `swag` **não está instalado**. Instalar com `go install github.com/swaggo/swag/cmd/swag@latest` antes da Fase 7 (ou pular regen se bloqueado).
- **Cobertura**: rodar `go build ./...` após cada fase; `go test ./internal/<pacote>/...` para testes unitários. Integração (`make test-backend-integration`) só quando o stack Docker estiver de pé.
