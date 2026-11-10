## 1. Backend

- [x] 1.1 Migration 000053 (colunas Pix em `organization_settings` com CHECK de tipo e par chave-tipo; tabela `unit_pix_accounts` com índice único parcial ativo) e down
- [x] 1.2 TDD `pixkey` (normalização e validação por tipo, limites de nome e cidade)
- [x] 1.3 TDD service Pix: ler, gravar organização, gravar conta da unidade (confirmação obrigatória, troca desativa a anterior), remover, resolver
- [x] 1.4 Repositório (integração): upsert sem apagar as regras, contas da unidade (único ativo, histórico, isolamento, unidade de outra organização)
- [x] 1.5 Handler (`GET/PUT /settings/pix`, `PUT/DELETE /settings/pix/units/{unitId}`) com Swagger e testes
- [x] 1.6 `payment.PixPayload` pelo resolvedor com a chave antiga como reserva; `receiver_name` no Pix autenticado e no público; testes
- [x] 1.7 Ligação em `cmd/api/main.go` e `CLAUDE.md` (settings e payment)

## 2. Frontend

- [x] 2.1 `lib/pix-settings.ts` (tipos, normalização e validação espelhadas, máscara, dedução do tipo da chave antiga) com TDD
- [x] 2.2 `/settings/pix`: chave padrão, sugestão da chave antiga, erros por campo
- [x] 2.3 Tabela por unidade e painel de edição com aviso, confirmação e "Usar chave padrão"
- [x] 2.4 `/settings/financial` redireciona; menu, paleta, Hoje (checklist e `hasPix`), `SendChargeDialog` e detalhe da cobrança apontam para `/settings/pix`
- [x] 2.5 Página pública mostra "Pague para {nome}"
- [x] 2.6 Testes de tela, painel, actions, redirecionamento e página pública

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), specs sincronizadas no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador (só leitura) e no backend pelos testes de integração
