# settings — Configurações da organização

Regras e preferências por organização (`organization_settings`, uma linha por organização): **regras financeiras** e **Pix** (chave padrão da organização e conta por unidade). As próximas ondas (mensagens, etc.) estendem a mesma tabela.

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

## Pix (migration 000053)

`organization_settings` ganhou `pix_key`, `pix_key_type`, `pix_receiver_name`, `pix_city`, `pix_updated_by/at` (CHECK: chave e tipo andam juntos) e há a tabela `unit_pix_accounts` (conta por unidade; índice único parcial **ativo**; trocar ou remover **desativa** a linha, sem DELETE: o histórico guarda `confirmed_by` e `confirmed_at`).

| Método | Rota | Permissão | Retorna |
|---|---|---|---|
| GET | /api/v1/settings/pix | `org:read` | `{default: {configured, key_type, key, receiver_name, city}, units: [{unit_id, key_type, key, receiver_name, confirmed_at}]}` (só contas ativas; a chave vai inteira, já está em todo código enviado ao inquilino) |
| PUT | /api/v1/settings/pix | `org:update` | grava a chave padrão; 400 `INVALID_PIX_KEY`, `INVALID_PIX` (nome > 25 ou cidade > 15), `INVALID_BODY` |
| PUT | /api/v1/settings/pix/units/{unitId} | `org:update` | grava a conta da unidade; exige `confirmed: true` (400 `CONFIRMATION_REQUIRED`, conferido **antes** da chave); 404 se a unidade não é da organização |
| DELETE | /api/v1/settings/pix/units/{unitId} | `org:update` | volta à chave padrão; 404 se não há conta ativa |

- `NormalizePixKey`: CPF/CNPJ com dígito verificador e só dígitos (`pkg/brdoc`), e-mail em minúsculas (até 77), telefone `+55` + dígitos (só Brasil), chave aleatória = UUID em minúsculas.
- Nome e cidade acima do limite do BR Code são **recusados**, não cortados. Vazios valem o nome do perfil e a cidade do imóvel.
- `ResolvePixAccount(org, unit)`: conta da unidade (sem cidade: vale a do imóvel), senão a da organização, senão nil. `payment.PixAccountAdapter` a entrega à cobrança.
- O upsert do Pix e o das regras mexem em colunas diferentes da mesma linha (um não apaga o outro).
