# settings — Configurações da organização

Regras e preferências por organização (`organization_settings`, uma linha por organização). Hoje só as **regras financeiras**; as próximas ondas de Configurações (mensagens, etc.) estendem a mesma tabela.

## Modelo

`FinancialRules`: `late_fee_percent` (0 a 10), `monthly_interest_percent` (0 a 5), `default_adjustment_index` (`IGP-M` | `IPCA`), `readjust_notice_days` (1 a 180). Os CHECKs da migration 000052 repetem essas faixas.

## Rotas

| Método | Rota | Permissão | Retorna |
|---|---|---|---|
| GET | /api/v1/settings/financial-rules | `org:read` (todos os papéis) | as regras gravadas, ou os padrões (2, 1, `IGP-M`, 60) se a organização nunca configurou |
| PUT | /api/v1/settings/financial-rules | `org:update` (só o dono) | upsert; 400 `INVALID_RULES` fora da faixa; 400 `INVALID_BODY` |

## Regras

- Valem para **novos contratos** (o formulário de novo contrato usa como padrão) e definem a janela do aviso de reajuste em Hoje. Contratos existentes não mudam.
- Valores com mais de 2 casas são arredondados a 2 antes de gravar (o que o banco guarda é o que a API devolve).
- A migration copia `default_late_fee`/`default_interest` de `financial_config.config` só quando são números dentro da faixa (CASE aninhado: o cast só roda depois da checagem de formato). Esses campos eram gravados e nunca lidos.
- **Dias de carência não existem**: mudariam a definição de "atrasada", que é decidida em SQL em vários módulos (change própria no futuro).
