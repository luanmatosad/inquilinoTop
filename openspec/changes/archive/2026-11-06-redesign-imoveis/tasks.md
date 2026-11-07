## 1. Ler o canvas e fechar as perguntas abertas

- [x] 1.1 Ler `Unidades-cadastrar`, `Imoveis-vazia`, `M-Imoveis` e `M-Imovel-cadastrar` no canvas e registrar no `design.md` os campos do painel de unidade, o estado vazio e o desenho mobile
- [x] 1.2 Confirmar se existe artboard mobile do detalhe do imóvel; se não existir, registrar a decisão de reaproveitar o desktop responsivo
- [x] 1.3 Buscar usos de `/properties/new` e `/properties/[id]/edit` no frontend. Achados: 2 links em `properties/page.tsx`, 1 em `[id]/page.tsx`, 1 no `TopBar.tsx`; testes: `TopBar.test.tsx` (muda em 4.2) e `nav.test.ts` (continua válido pelo prefixo `/properties`)

## 2. Backend: tipo COMMERCIAL, número e complemento (spec property-registry)

- [x] 2.1 Testes de serviço: `COMMERCIAL` é aceito e não cria unidade, `SINGLE` continua criando "Unidade 01", tipo desconhecido é rejeitado
- [x] 2.2 Testes de handler: `number` e `complement` voltam na resposta; `number` com mais de 20 e `complement` com mais de 100 caracteres retornam 400
- [x] 2.3 Teste de integração do repositório: criar `COMMERCIAL` com `number` e `complement` e ler de volta
- [x] 2.4 Criar a migration `000046` (up e down). A constraint se chama `properties_type_check` (confirmado no banco de dev); o down falha de propósito se houver imóveis `COMMERCIAL`, verificado nos dois cenários
- [x] 2.5 Atualizar `model.go` (`oneof` com `COMMERCIAL`, campos `Number` e `Complement` em `Property` e `CreatePropertyInput`), `service.go` e `repository.go` (insert, update, select, scan)
- [x] 2.6 Rodar `swag init`, atualizar `backend/docs/` e as annotations do handler
- [x] 2.7 Atualizar `.claude/rules/domain-model.md` (enum de Property) e criar o ADR `property-0002` (COMMERCIAL multiunidade) com a linha no `docs/decisions/README.md`
- [x] 2.8 Rodar a suíte do backend em série (`go test -p 1 ./...`, como o Makefile): tudo verde exceto `payment.TestService_GenerateMonth_IPTUMissing`, que já falhava e não tem relação com esta change (o teste fixa o mês `2026-04`, mas monta o contrato relativo à data de hoje). Não corrigido aqui

## 3. Frontend: tipos, schemas e ocupação (spec property-occupancy)

- [x] 3.1 Testes de `buildOccupancy`: contrato `ACTIVE` vira alugada, `ENDED`/`CANCELED` vira vaga, dois ativos escolhem o `start_date` mais recente, inquilino ausente não quebra, KPIs somam certo, lista vazia
- [x] 3.2 Implementar `src/lib/property-occupancy.ts` como função pura
- [x] 3.3 Testes de schema: `COMMERCIAL`, `number` e `complement` válidos e inválidos
- [x] 3.4 Atualizar `src/types/index.ts` e `src/lib/schemas.ts` (tipo `COMMERCIAL`, `number`, `complement`) e `actions.ts` para enviar os campos novos
- [x] 3.5 Criar o formatador de endereço composto (logradouro, número, complemento, bairro, cidade/UF) com teste
- [x] 3.6 Criar o formatador de "desde MM/AAAA" com teste

## 4. Componentes de UI

- [x] 4.1 Conferir `table` e `tabs` no `shadcnds`: mesma estrutura e classes, só muda a sintaxe (`forwardRef` × função) e os seletores do preset. Já são usados por 9 telas, então ficam como estão e a composição é por classes; trocar o componente é uma change à parte. Validação visual no 8.2
- [x] 4.2 Remover "Novo imóvel" do `TopBar` e atualizar o `TopBar.test.tsx`

## 5. Lista de imóveis

- [x] 5.1 Testes da página/lista: tabela com colunas e linha de exemplo, "Casa" para `SINGLE`, busca, filtro por tipo, estado vazio, erro com nova tentativa, degradação sem contratos
- [x] 5.2 Buscar imóveis e contratos em paralelo (a lista não precisa dos inquilinos; eles entram só no detalhe); erro de imóveis é erro da tela, o de contratos degrada
- [x] 5.3 Implementar KPIs, tabela, busca e filtro por tipo (`?q=` e `?tipo=`), estado vazio e cartões no celular
- [x] 5.4 Botão "Cadastrar imóvel" no cabeçalho da página, abrindo o painel por `?novo=1`

## 6. Cadastro em painel lateral

- [x] 6.1 Testes do painel: abre com `?novo=1`, fecha ao salvar, permanece aberto com erro de validação, aviso do tipo Casa, campos novos enviados
- [x] 6.2 Refazer `PropertyForm` no layout do canvas (CEP, nome, tipo, endereço, número, complemento, bairro, cidade, UF) dentro de `Sheet`, sem alterar a validação
- [x] 6.3 Redirecionar `/properties/new` para `/properties?novo=1`
- [x] 6.4 Painel de unidade (`UnitForm`) aberto por `?unidade=nova` e `?unidade=<id>` conforme 1.1

## 7. Detalhe do imóvel

- [x] 7.1 Testes do detalhe: abas Unidades e Informações por `?aba=`, linha de unidade alugada com inquilino e "desde", unidade vaga com "—", botão "Adicionar unidade"
- [x] 7.2 Reescrever `[id]/page.tsx` com `Tabs`, cabeçalho (nome, endereço, tipo, nº de unidades) e tabela de unidades com situação
- [x] 7.3 Aba Informações com o formulário de edição; redirecionar `/properties/[id]/edit` para `?aba=informacoes`
- [x] 7.4 `UnitList` foi substituída por `UnitTable` + `UnitRowActions` (desativar continua exclusão lógica, com confirmação); `DeletePropertyButton` segue igual no cabeçalho

## 8. Verificação

- [x] 8.1 Rodar `make frontend-lint` e a suíte Vitest completa; tudo verde
- [x] 8.2 Frontend reconstruído e percorrido no navegador: lista, detalhe (abas Unidades e Informações), painel de imóvel (com validação e Cancelar), painel de unidade, celular a 390px e tema escuro. A aba estava com a sessão do próprio usuário, então só houve leitura, sem gravar. Estado vazio e cadastro com sucesso ficam cobertos por teste (não reproduzidos no navegador)
- [x] 8.3 Criar `COMMERCIAL` e `SINGLE` e conferir tipo, número, complemento e unidade automática. Feito pela API com o usuário de teste (COMMERCIAL: 0 unidades; SINGLE: "Unidade 01"; tipo inválido e `number` longo: 400; update de `number`), com limpeza por exclusão lógica
- [x] 8.4 Atualizar `frontend/CLAUDE.md` e `backend/internal/property/CLAUDE.md` com os campos e telas novos
