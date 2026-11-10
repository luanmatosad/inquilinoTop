## Context

Canvas: `Configuracoes-pix` (Tipo de chave, Chave Pix, "Nome de quem recebe" com "Aparece para o inquilino na hora de pagar", Cidade; tabela "Receber em outra conta por imóvel" com Recebe em, Situação Chave padrão/Outra chave, ações Usar outra chave/Editar; rodapé "O ImoviFlow não guarda nem repassa seu dinheiro"), `Configuracoes-pix-imovel` (painel "Chave Pix do imóvel": tipo, chave, nome, "Precisa ser o titular da conta", aviso "Antes de salvar: Os pagamentos desse imóvel vão para outra conta, não para a sua. Confirme com o dono do imóvel e guarde o combinado" e checkbox de confirmação). Verificado: `PixPayload` lê `financial_config.pix_key`, o nome do perfil (`OwnerReader`) e a cidade do imóvel; `pix.Build` limpa acentos e corta nome (25) e cidade (15), com "RECEBEDOR" e "BRASIL" de reserva; `pkg/brdoc` tem `ValidCPF` e `ValidCNPJ`; `GET /payments/config` é usado em Hoje (`hasPix`); permissões: `org:read` (todos) e `org:update` (só o dono).

## Goals / Non-Goals

**Goals:** chave validada e normalizada; conta por unidade com trilha; o inquilino vê para quem paga.
**Non-Goals:** provedor e dados bancários, reautenticação por senha, aviso por e-mail, Pix por imóvel inteiro, múltiplas chaves por unidade.

## Decisions

1. **Onde guardar.** Colunas em `organization_settings` (`pix_key`, `pix_key_type` em `CPF|CNPJ|EMAIL|PHONE|RANDOM`, `pix_receiver_name`, `pix_city`, `pix_updated_by`, `pix_updated_at`; chave e tipo andam juntos por CHECK) e tabela nova `unit_pix_accounts` (`id`, `organization_id`, `unit_id`, `pix_key`, `pix_key_type`, `receiver_name`, `confirmed_by`, `confirmed_at`, `is_active`, `created_at`, `updated_at`; índice único parcial `(unit_id) WHERE is_active`). Trocar a conta da unidade desativa a linha e cria outra; remover só desativa (sem DELETE). O upsert das regras (000052) não toca nas colunas Pix e vice-versa.
2. **Resolução da chave** (cobrança): conta ativa da unidade do contrato → Pix da organização → `financial_config.pix_key` antiga (só a chave; sem tipo). Nenhuma chave em nenhum: 422 `PIX_KEY_NOT_CONFIGURED`, como hoje. Nome: o da conta escolhida, senão o do perfil (como hoje); cidade: a da conta escolhida, senão a do imóvel (como hoje). A tela mostra a chave antiga como sugestão para quem ainda não salvou (tipo deduzido), com "Salve para confirmar".
3. **Validação e normalização (backend manda; o frontend repete para avisar cedo).** CPF e CNPJ: pontuação removida, dígito verificador conferido (`brdoc`), grava só dígitos. E-mail: formato básico, minúsculas, até 77 caracteres. Telefone: só dígitos, 10 a 11 (DDD + número) ou 12 a 13 começando em 55, grava `+55` + dígitos. Chave aleatória: UUID, minúsculas. Nome do recebedor até 25 e cidade até 15 caracteres: **recusa** acima disso (400 `INVALID_PIX`) em vez de cortar sem avisar; vazios usam as reservas. Erros: 400 `INVALID_PIX_KEY` (com o tipo na mensagem) e 400 `INVALID_PIX`.
4. **Rotas** em `/settings`, `GET /settings/pix` (`org:read`): `{default: {configured, key_type, key, receiver_name, city} | {configured:false}, units: [{unit_id, key_type, key, receiver_name, confirmed_at}]}` (só contas ativas); `PUT /settings/pix` (`org:update`); `PUT /settings/pix/units/{unitId}` (`org:update`, corpo com `confirmed: true`; senão 400 `CONFIRMATION_REQUIRED`; a unidade precisa ser da organização, senão 404); `DELETE /settings/pix/units/{unitId}` (`org:update`, volta à chave padrão; 404 se não há conta ativa). A chave é devolvida inteira: ela já vai em todo código Pix enviado aos inquilinos.
5. **Proteções do Pix por unidade.** Só o dono; confirmação obrigatória **no servidor** (o checkbox da tela não basta); autor e data da confirmação gravados; histórico preservado (linhas desativadas); a página pública mostra o nome de quem recebe.
6. **O inquilino vê para quem paga.** `PixCode` ganha `receiver_name` (o nome como entra no código: sem acento, maiúsculas, até 25); `GET /public/payments/{token}/pix` o devolve e `/p/[token]` mostra "Pague para {NOME}" junto do QR. Se a conta da unidade for de terceiros, o inquilino vê o nome combinado.
7. **Frontend.** `/settings/pix` (Recebimento (Pix)): formulário da chave padrão (tipo, chave com máscara e dica por tipo, nome, cidade) e a tabela por unidade (rótulo "Unidade · Imóvel" de `/properties`, "Recebe em" com chave mascarada, Situação, ação) com painel lateral de edição (campos, o aviso, o checkbox e **Usar chave padrão**). `/settings/financial` redireciona para `/settings/pix`; menu, paleta, checklist de Hoje, `SendChargeDialog` e o detalhe da cobrança apontam para `/settings/pix`. Provedor, Asaas e dados bancários saem da tela; como os endpoints novos não escrevem em `financial_config`, os valores gravados ficam como estão. Hoje considera "Pix configurado" se há Pix da organização **ou** a chave antiga.
8. **Máscara.** `CPF ···.789-09`, `CNPJ ··.···.···/0001-90`, e-mail e telefone parcialmente ocultos, chave aleatória com início e fim; a chave completa só aparece ao abrir a edição.

## Risks / Trade-offs

- **Sessão roubada do dono** pode trocar a chave e redirecionar cobranças. Mitigações desta change: só o dono, histórico com autor e data, nome visível ao inquilino. Follow-ups recomendados: pedir a senha para trocar a chave e avisar por e-mail.
- Quem só tem a chave antiga continua funcionando (fallback), mas sem tipo; a tela pede para salvar e confirmar.
- Nome ou cidade longos antes aceitos passam a ser recusados ao salvar a tela nova (a cobrança continua cortando, como hoje, enquanto não salvarem).
- A cobrança atual não registra qual conta recebeu; o histórico de contas por unidade permite reconstruir (confirmed_at e desativação).

## Migration Plan

Migration 000053 aditiva (colunas e tabela novas). Rollback: `down` remove as colunas e a tabela; `financial_config` não é alterado e o Pix volta a usar a chave antiga.

## Open Questions

Nenhuma bloqueante.
