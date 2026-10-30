## Why

O contrato liga inquilino e unidade e gera as cobranças; é o centro do MVP. O backend já tem criar, encerrar, renovar e reajustar, mas faltam regras que evitam erro caro (dois contratos ativos na mesma unidade, datas incoerentes) e o frontend não expõe o ciclo completo nem a geração das cobranças. Além disso, a UI espera um campo `notes` que o modelo Go não tem.

## What Changes

- Regra: uma unidade só pode ter um contrato `ACTIVE` por vez (sem sobreposição de período).
- Validações: `end_date` posterior a `start_date`; unidade e inquilino da mesma organização e ativos; contrato não cria para inquilino ou unidade excluídos.
- Campo `notes` em `leases` (alinha UI e API).
- Ao criar contrato, opção de gerar automaticamente as cobranças de aluguel do período (reusa `POST /leases/{id}/payments/generate`).
- Encerrar contrato: cobranças futuras `PENDING` são canceladas logicamente (`is_active=false`); cobranças pagas e vencidas permanecem.
- Frontend: fluxo completo em `/leases` (criar, detalhar, encerrar, renovar, reajustar, ver cobranças do contrato), componentes só de shadcn/ui.
- Frontend: remover `/owner/contracts/**` (duplicada), com redirect para `/leases`.
- **BREAKING**: criar contrato sobreposto passa a retornar 409; clientes que dependiam disso precisam tratar.

## Capabilities

### New Capabilities
- `lease-management`: ciclo de vida do contrato (criar, validar, encerrar, renovar, reajustar) e sua relação com as cobranças.

### Modified Capabilities
<!-- Nenhum spec existente. -->

## Impact

- **Backend**: `internal/lease` (service, repository, handler, testes), leitura de cobranças via interface de `payment` para o cancelamento no encerramento, migration `000038_add_lease_notes` e índice de apoio à checagem de sobreposição, Swagger.
- **Frontend**: `src/app/leases/**`, `src/components/leases/*`, `src/data/owner/contracts-dal.ts`, rotas `/owner/contracts/**`, `Sidebar`, `next.config.ts`.
- **Depende de**: `mvp-cadastros` (unidade e inquilino válidos e únicos).
- **Fora de escopo**: vários inquilinos por contrato, fiadores, seguro-fiança, tipos de contrato, cláusulas, assinatura eletrônica, reajuste automático agendado.
