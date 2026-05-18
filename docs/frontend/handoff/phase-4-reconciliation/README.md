# Phase 4 — `/financial/reconciliation` (tela nova)

**Status:** ⏳ Em design — não pronto pra dev
**Branch sugerida:** `feat/reconciliation` (quando design fechar)

## O que é

**Conciliação bancária**: cruzar movimentações importadas do extrato bancário (CNAB ou OFX) com cobranças/despesas registradas no sistema. O objetivo é responder à pergunta "tudo que entrou e saiu da conta bate com o que eu disse que ia entrar/sair?".

## Por que não está pronto

Faltam decisões de produto antes do design fechar:

### Bloqueios

1. **Formato de extrato** — CNAB-240, CNAB-400 (Febraban), ou OFX? Qual o Go suporta hoje? Os três bancos brasileiros mais usados (Itaú, Bradesco, Banco do Brasil) ainda exportam CNAB; bancos digitais (Nubank, Inter) padronizaram OFX. Decidir se vamos suportar os dois desde v1.
2. **Sugestão de match** — regra simples (valor exato + data ± 2 dias) ou ML/scoring (que considere texto da transação, padrão do pagador, etc.)? **Sugestão:** v1 com regra simples, abrir ticket pra v2 com scoring.
3. **Granularidade de aprovação** — usuário aprova match a match, ou aprova um lote inteiro com botão "Aceitar todas as sugestões"? Provavelmente ambos.
4. **Tratamento de não-conciliados** — quando o extrato tem entrada que não bate com nenhuma cobrança, oferecemos:
   - "Criar cobrança manual a partir desta linha"
   - "Marcar como avulso" (entrada não vinculada — ex.: aporte do proprietário)
   - "Ignorar" (esconder da lista mas manter no DB)
5. **Múltiplas contas bancárias** — uma imobiliária grande tem várias contas. A tela é por-conta ou unificada com filtro?

## Pré-requisitos antes do handoff

Quando você decidir essas questões, eu volto pra:

1. Desenhar a mock React equivalente a `Contas a receber.html` (com painel Tweaks pros estados)
2. Especificar layout, colunas, ações, modais
3. Modelar tipos (`BankTransaction`, `Match`, `Reconciliation`)
4. Definir endpoints Go necessários
5. Escrever README + SPEC + CLAUDE_CODE_PROMPT como nas fases 1–3

## Hipótese de layout (preliminar — não comprometida)

```
┌─────────────────────────────────────────────────────────────┐
│ H1 "Conciliação bancária"     [Importar extrato] [Filtros] │
├─────────────────────────────────────────────────────────────┤
│ Tab por conta: [Conta principal] [Conta caução] [Histórico] │
├─────────────────────────────────────────────────────────────┤
│ Resumo: 47 linhas · 41 conciliadas · 5 sugestões · 1 pendente│
├─────────────────────────────────────────────────────────────┤
│ Linhas do extrato (esquerda) ←→ Sugestão de match (direita) │
│  • 05/05 +R$ 3.250        →  Aluguel João Silva ★ confiança 98% │
│  • 06/05 −R$ 480          →  Reparo hidráulico ★ confiança 76% │
│  • 07/05 +R$ 5.100        →  ?? sem match — [Criar] [Avulso] │
└─────────────────────────────────────────────────────────────┘
```

## Telas relacionadas

- Phase 2 (Payables) e Phase 1 (Receivables) **alimentam** os matches.
- Toda action de match faz `revalidatePath` nas duas telas anteriores para refletir o status `RECONCILED`.

## Backend (Go) — estimativa de trabalho

- Parser CNAB-240 (existe lib em Go: `joaosoft/cnab` ou implementar do zero) — ~1 semana
- Parser OFX — ~3 dias
- Engine de match (regra simples) — ~2 dias
- API endpoints (import, listar transações, sugerir, confirmar) — ~3 dias

Total: ~2 semanas só no backend antes do frontend poder ser integrado. Considere se isso é prioridade vs. Phase 5 (Commissions).

---

**Próximo passo do design:** uma sessão de discovery comigo, ~30min, pra fechar os 5 bloqueios acima. Depois eu produzo a mock + handoff em uma iteração.
