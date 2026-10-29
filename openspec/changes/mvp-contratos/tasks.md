## 1. Banco de dados

- [x] 1.1 Confirmar `btree_gist` disponível no Postgres de dev, teste e produção; definir fallback com lock se não estiver (dev e teste: `postgres:16-alpine` traz `btree_gist` 1.7; **produção ainda precisa ser conferida** com `SELECT * FROM pg_available_extensions WHERE name='btree_gist'` antes do deploy; o fallback com lock está descrito no comentário da migration 039)
- [x] 1.2 Listar contratos ativos sobrepostos já existentes e resolver antes de migrar (dev: nenhum; a migration 039 aborta listando sobreposições)
- [x] 1.3 Escrever `000038_add_lease_notes` up/down
- [x] 1.4 Escrever `000039_lease_no_overlap` up/down (extensão + `EXCLUDE` por unidade e período)
- [x] 1.5 Aplicar e reverter no Postgres de testes (`:5433`)

## 2. Backend: regras (TDD)

- [ ] 2.1 Escrever testes de service: datas incoerentes, unidade/inquilino de outra organização ou inativos, sobreposição, período sequencial, `end_date` nulo
- [ ] 2.2 Implementar validações e checagem de sobreposição (`LEASE_OVERLAP`) com `UnitReader`/`TenantReader`
- [ ] 2.3 Adicionar `notes` ao model, inputs, repository e handler
- [ ] 2.4 Teste de integração da constraint com duas criações simultâneas
- [ ] 2.5 Testes e implementação de `generate_payments` na criação (prazo fechado, aberto com 12 meses, idempotência)
- [ ] 2.6 Testes e implementação de encerramento: desativa pendentes futuras sem `charge_id`, preserva pagas e vencidas, sinaliza as com cobrança emitida
- [ ] 2.7 Testes de renovação (data anterior, sobreposição) e reajuste (limites do percentual, histórico)
- [ ] 2.8 Registrar a exceção à imutabilidade de `payment` num ADR em `docs/decisions/payment/` e indexar no README
- [ ] 2.9 Atualizar handler, mapeamento de erros, Swagger e `internal/lease/CLAUDE.md`
- [ ] 2.10 `make test-backend` e `make test-backend-integration` sem falhas

## 3. Frontend: consolidação

- [ ] 3.1 Comparar `/owner/contracts/**` com `/leases/**` e portar o que faltar
- [ ] 3.2 Remover `/owner/contracts/**` e `contracts-dal.ts` duplicado; adicionar redirect permanente em `next.config.ts`

## 4. Frontend: telas

- [ ] 4.1 Formulário de criação com unidade, inquilino, datas, aluguel, caução, dia de pagamento, multa, juros, `notes` e opção "gerar cobranças"
- [ ] 4.2 Tratamento de erros `LEASE_OVERLAP`, datas inválidas e recursos inexistentes no formulário
- [ ] 4.3 Detalhe do contrato com abas (dados, cobranças, reajustes) usando `tabs` do shadcn
- [ ] 4.4 Ações de encerrar, renovar e reajustar com `alert-dialog`/`dialog` e feedback via `sonner`
- [ ] 4.5 Estados de carregamento, vazio e erro na lista e no detalhe

## 5. Verificação

- [ ] 5.1 `make frontend-lint` e build sem erros
- [ ] 5.2 Fluxo manual: criar contrato com cobranças, tentar sobrepor, reajustar, renovar e encerrar
- [ ] 5.3 Atualizar `CLAUDE.md` raiz se o status do módulo mudar
- [ ] 5.4 `openspec validate mvp-contratos`
