## Why

O Pix é o coração da cobrança manual, mas a configuração é crua: uma chave em texto livre (`financial_config.pix_key`), o nome do recebedor tirado do perfil e a cidade do imóvel, sem validar a chave. O canvas (`Configuracoes-pix`, `Configuracoes-pix-imovel`, `M-Config-pix`) pede tipo de chave, nome e cidade próprios e **uma conta diferente por unidade**, para imóveis que são de outra pessoa ou empresa. Receber em outra conta redireciona o dinheiro de inquilinos, então precisa de proteções.

## What Changes

- Backend (`internal/settings`): Pix da organização (tipo, chave, nome, cidade) com validação por tipo (CPF e CNPJ com dígito verificador, e-mail, telefone, chave aleatória) e normalização; Pix por unidade com confirmação obrigatória de quem autorizou, gravada com autor e data, e histórico mantido ao trocar ou remover.
- A cobrança passa a montar o Pix pela chave da unidade, senão a da organização, senão a antiga `financial_config.pix_key` (nada se perde). A página pública mostra **"Pagar para {nome}"** (o nome que vai no código), para o inquilino notar se algo estiver errado.
- Frontend: tela `/settings/pix` (Recebimento (Pix)) com a chave padrão e a tabela "Receber em outra conta por imóvel" com painel de edição; `/settings/financial` redireciona para ela; links e Hoje apontam para a nova tela.
- Fora: provedor, Asaas e dados bancários (saem da tela, o backend fica e os valores gravados não mudam), reconfirmação por senha ao trocar a chave, aviso por e-mail da troca, Pix por imóvel inteiro (é por unidade, como as linhas do canvas).

## Capabilities

### New Capabilities
- `pix-settings`: chave Pix da organização e por unidade (validação, confirmação, histórico, resolução e tela).

### Modified Capabilities
- `pix-payload`: a chave vem da unidade, da organização ou da configuração antiga, e o nome e a cidade vêm das configurações do Pix.
- `public-payment-link`: o Pix público informa para quem se paga.

## Impact

- Backend: migration 000053 (colunas Pix em `organization_settings` e tabela `unit_pix_accounts`), `internal/settings` (Pix), `internal/payment` (`PixPayload`, resposta pública), `cmd/api/main.go`, Swagger, `CLAUDE.md`. Usa `pkg/brdoc` (CPF e CNPJ).
- Frontend: `app/settings/pix`, `lib/pix-settings.ts`, menu e links, `app/page.tsx` (Hoje), página pública `/p/[token]`.
- Segurança: dinheiro de inquilinos pode ser redirecionado por quem tem `org:update` (só o dono); proteções no design.
