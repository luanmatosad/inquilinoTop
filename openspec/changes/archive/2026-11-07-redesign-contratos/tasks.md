## 1. Ler o canvas e fechar as perguntas abertas

- [x] 1.1 Ler `Contratos-vazia`, `M-Contratos` e `M-Contrato-detalhe` no canvas e registrar no `design.md` o estado vazio, o desenho mobile e qualquer divergência do desktop
- [x] 1.2 Conferir a precisão da coluna `daily_interest_percent` (migration de origem) e que 6 casas decimais cabem; se não couberem, registrar a decisão no `design.md`
- [x] 1.3 Conferir no backend o limite e o tipo aceitos no upload de documentos (`ParseMultipartForm`, tipo MIME) e como o download é autorizado; registrar no `design.md`
- [x] 1.4 Buscar usos de `CreateLeaseDialog`, `LeaseForm`, `LeaseActions` e `ActiveLeaseCard` no frontend e listar o que muda; localizar quem monta `PaymentHooks` em `cmd/api/main.go`

## 2. Backend: aluguel de referência da unidade (spec property-registry)

- [x] 2.1 Testes de validação e handler: `reference_rent` válido, negativo (400) e ausente; testes de repositório (integração): gravar e ler de volta em criar, atualizar e listar
- [x] 2.2 Migration `000047` (up e down) e campo `ReferenceRent` em `Unit` e `CreateUnitInput` (`gte=0`), com `repository.go` em todas as queries de unidade
- [x] 2.3 Rodar os testes do módulo `property` (unitários e integração); tudo verde

## 3. Backend: índice, mês e próximo reajuste (spec lease-management)

- [x] 3.1 Testes de `nextReadjustment`: após o início, após um reajuste, mês diferente do início, sem mês, virada de ano, base em dezembro
- [x] 3.2 Testes de serviço e handler: `adjustment_index`/`adjustment_month` em criar e atualizar, mês padrão igual ao de `start_date`, valores inválidos (400)
- [x] 3.3 Teste de integração: migration preenche `adjustment_month` dos contratos existentes e a listagem traz `next_readjustment` sem uma consulta por contrato
- [x] 3.4 Migration `000048` (up e down) com `adjustment_index`, `adjustment_month` e `end_reason`, e backfill do mês
- [x] 3.5 Implementar `nextReadjustment` (função pura), campos no modelo, validações, `UpdateLeaseInput`, repositório (inclusive o último `applied_at` por contrato num único `LEFT JOIN`) e `next_readjustment` em `GET /leases` e `GET /leases/{id}`

## 4. Backend: encerrar com data e motivo

- [x] 4.1 Testes de serviço e handler: sem corpo (comportamento atual), com `end_date`, com `reason`, motivo inválido (400), data antes do início (422), saída que não estende o prazo, contrato já encerrado (409)
- [x] 4.2 As cobranças futuras são desativadas a partir da data de saída e as anteriores permanecem: coberto pelo teste de integração existente de `DeactivateFuturePending(after)` no repositório de `payment` e pelos testes de serviço, que conferem que o corte é a data de saída efetiva
- [x] 4.3 Implementar `End` com corpo opcional no handler e no serviço, `end_reason` no repositório e `CancelFuturePending(after = end_date)`; manter o `LEAST` do fim previsto

## 5. Backend: reajuste atualiza as cobranças futuras (ADR payment-0004)

- [x] 5.1 Testes de repositório de `payment` (integração): atualiza só `RENT` + `PENDING` + ativo + sem `charge_id` + vencimento a partir da vigência; não altera `PAID`, `EXPENSE`, vencimento anterior, `charge_id` preenchido nem outro contrato; conta as de `charge_id` como revisão
- [x] 5.2 Testes de serviço de `lease`: reajuste chama o gancho com o novo valor e a data de vigência, devolve `payments_updated`/`payments_need_review`, e a falha do gancho mantém o reajuste e devolve `payments_error`
- [x] 5.3 Implementar o `UPDATE` no repositório e no serviço de `payment`, o método em `PaymentHooks` e `LeaseHooks`, e os campos novos em `ReadjustOutput`
- [x] 5.4 A composição em `cmd/api/main.go` não muda (`LeaseHooks` passa a satisfazer a interface ampliada, e o build confirma). O reajuste automático (`/adjust`) delega para `Readjust`, então também atualiza as cobranças futuras, com vigência no mês de referência do índice; coberto por teste

## 6. Backend: documentação e verificação

- [x] 6.1 Atualizar annotations do Swagger (corpo opcional de `/end`, `next_readjustment`, saída do `/readjust`) e rodar `swag init`
- [x] 6.2 Criar o ADR `payment-0004` (reajuste atualiza cobranças futuras pendentes sem cobrança emitida) com a linha no `docs/decisions/README.md`; atualizar `domain-model.md` e os `CLAUDE.md` de `lease` e `property`
- [x] 6.3 Suíte do backend em série (`go test -p 1 ./...`): tudo verde exceto `payment.TestService_GenerateMonth_IPTUMissing`, que já falhava (depende da data de hoje) e não tem relação com esta change. Não corrigida aqui

## 7. Frontend: módulos puros (spec lease-overview)

- [x] 7.1 Testes de `monthlyToDaily`/`dailyToMonthly`: ida, volta, ida e volta sem deriva, zero e vazio
- [x] 7.2 Testes de `buildLeaseRows` e `buildLeaseIndicators`: linhas completas, unidade e inquilino ausentes, soma do aluguel, fronteira dos 30 e dos 90 dias, contrato aberto, reajuste vencido, `ENDED`/`CANCELED`, virada do mês no fuso de São Paulo
- [x] 7.3 Testes da prévia de reajuste (`previewReadjustment`: novo valor e aumento com arredondamento) e do formatador de mês "MM/AAAA"
- [x] 7.4 Testes de `preserveLeaseFields` (caução, valor anual e ano do IPTU e status voltam do contrato atual)
- [x] 7.5 Implementar `src/lib/lease-overview.ts`, `src/lib/interest.ts`, `src/lib/lease-form.ts` e os formatadores; atualizar `lease-schemas.ts` (índice, mês, juros ao mês, encerramento) e `types`

## 8. Frontend: unidade com aluguel de referência

- [x] 8.1 Testes do `UnitForm`: campo "Aluguel de referência (opcional)" com a dica, valor inválido, envio do valor
- [x] 8.2 Implementar o campo em `UnitForm`, `schemas.ts` e `unit-form.ts`, com a máscara de reais

## 9. Frontend: lista de contratos

- [x] 9.1 Testes da página: indicadores, colunas, linha de exemplo, "Sem fim", próximo reajuste em MM/AAAA e "pendente", busca por inquilino e unidade, filtro `?situacao=`, estado vazio, "Nenhum contrato encontrado.", erro com nova tentativa, degradação sem inquilinos e sem imóveis, cards no celular
- [x] 9.2 Buscar contratos, inquilinos e imóveis em paralelo (`Promise.allSettled`); erro de contratos é erro da tela
- [x] 9.3 Implementar indicadores, tabela, cards, busca, filtro, rodapé e o botão "Criar contrato" (`?novo=1`)

## 10. Frontend: criar e editar em painel

- [x] 10.1 Testes do painel de criação: campos do canvas, pré-seleção por `?inquilino=` e `?unidade=`, aluguel sugerido pela unidade sem sobrescrever o digitado, mês de reajuste padrão, multa e juros padrão com "Alterar neste contrato", `generate_payments`, `LEASE_OVERLAP`, validação, fechar tirando só o parâmetro
- [x] 10.2 Testes do painel de edição: unidade, inquilino e início como texto, valores atuais, caução preservada no corpo enviado
- [x] 10.3 Refazer `LeaseForm` no layout do canvas e implementar `LeaseFormSheet` (estado local mais ajuste na renderização), mapeando `LEASE_OVERLAP`; remover `CreateLeaseDialog`

## 11. Frontend: detalhe, encerrar e reajustar

- [x] 11.1 Testes do detalhe: cabeçalho, 4 cobranças mais recentes e "de N", histórico com a linha "Início", termos (incluindo juros em % ao mês), contrato `ENDED` sem botões de ação e com data e motivo, 404, degradação sem cobranças e sem reajustes
- [x] 11.2 Reescrever `[id]/page.tsx` sem abas, com buscas em paralelo, e remover `LeaseActions` e `ActiveLeaseCard` se ficarem sem uso
- [x] 11.3 Testes do modal de encerramento: texto do efeito com a data, aviso de data no passado, envio de `end_date` e `reason`, contagens no aviso, Voltar
- [x] 11.4 Implementar `EndLeaseDialog` (`?encerrar=1`) e a action `endLease` com corpo
- [x] 11.5 Testes do painel de reajuste: prévia (R$ 1.550,00 + 4,5%), percentual inválido, envio como fração com índice e vigência, aviso de cobranças atualizadas e de revisão, WhatsApp só com celular válido
- [x] 11.6 Implementar `ReadjustSheet` (`?reajustar=1`) e atualizar a action `readjustLease`

## 12. Frontend: contrato assinado

- [x] 12.1 Testes: recusa arquivo acima de 10 MB ou que não seja PDF sem chamar o backend, envio válido, listagem e link de download
- [x] 12.2 Implementar a Server Action de upload, a listagem e a rota de download no Next (repassa o cookie), e a seção Documentos do detalhe

## 13. Frontend: integração e limpeza

- [x] 13.1 Atualizar o "Criar contrato" do detalhe do inquilino para `/leases?novo=1&inquilino=<id>` (código e teste)
- [x] 13.2 Atualizar `/units/[id]` (resumo do contrato com link para o detalhe e "Criar contrato" para `/leases?novo=1&unidade=<id>`) e só então remover `LeaseActions`, `ActiveLeaseCard` e `CreateLeaseDialog`, conferindo que nada mais os referencia
- [x] 13.3 Rodar `make frontend-lint` e a suíte Vitest completa; tudo verde

## 14. Verificação

- [x] 14.1 Reconstruir backend e frontend (`docker compose up -d --build`) e conferir pela API, com o usuário de `make seed-dev-user`: criar contrato com índice e mês, `next_readjustment`, encerrar com data e motivo (cobranças futuras canceladas a partir da data), reajustar (cobranças futuras atualizadas, pagas e IPTU intactas) e editar sem perder a caução; limpar os dados no fim
- [x] 14.2 Percorrer no navegador, no desktop e no celular (390px), nos temas claro e escuro: lista, vazio, criar, detalhe, encerrar, reajustar, editar e anexar. Se a sessão do navegador for a do próprio usuário, fazer só leitura e registrar o que não foi visto
- [x] 14.3 Atualizar `frontend/CLAUDE.md` com os padrões de Contratos
