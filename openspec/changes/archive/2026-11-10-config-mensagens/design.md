## Context

Canvas: lista "3 dias antes do vencimento · Lembrete gentil · WhatsApp · Editar", "No dia do vencimento · Cobrança com Pix", "3 dias depois · Aviso de atraso", "10 dias depois · Segundo aviso, tom mais firme", botão "Adicionar lembrete", e o editor "Modelo: cobrança no vencimento" com variáveis `{nome} {valor} {vencimento} {imóvel} {pix} {mês}` (e `{link}` no texto de exemplo), "Toque numa variável para inserir no texto" e "Prévia com dados da Marina". Verificado: `buildChargeMessage` monta um texto fixo (atrasada ou não), e o link da página pública, quando gerado, **substitui** o código Pix na mensagem (`SendChargeDialog.autoMessage`); a página de detalhe passa nome, mês, unidade, valor, vencimento e Pix ao diálogo; Hoje leva ao diálogo por `?enviar=1`; o PUT de configurações exige `org:update` e a leitura `org:read`.

## Goals / Non-Goals

**Goals:** modelos editáveis por momento (antes, no dia, depois), prévia, e o diálogo de envio usando o modelo certo.
**Non-Goals:** agenda e "já enviei" em Hoje, canal por lembrete, envio automático, mais de um modelo por momento.

## Decisions

1. **Tabela `reminder_templates`** (`id`, `organization_id`, `name`, `offset_days` inteiro, `body`, `is_active`, `created_by`, `created_at`, `deactivated_at`) com índice único parcial `(organization_id, offset_days) WHERE is_active`. Salvar a lista **desativa** os lembretes ativos e cria os novos numa transação (sem DELETE, o histórico fica).
2. **API:** `GET /settings/reminders` (`org:read`) devolve a lista ativa ordenada por dias; sem linhas, devolve os 4 padrões (sem gravar). `PUT /settings/reminders` (`org:update`) **substitui a lista inteira** (corpo `{reminders: [{name, offset_days, body}]}`), devolve a lista salva; 400 `INVALID_REMINDERS` com a mensagem do problema.
3. **Validação (backend manda):** de 1 a 8 lembretes; nome de 1 a 40 caracteres; dias inteiros de -30 a 60 e **únicos**; texto de 1 a 1000 caracteres; só as variáveis `{nome}`, `{valor}`, `{vencimento}`, `{imóvel}`, `{mês}`, `{pix}` e `{link}` (qualquer outra, como `{nom}`, é recusada com o nome dela).
4. **Padrões** (quando a organização nunca salvou): os quatro do canvas, com textos próximos ao da mensagem atual, terminando em "Pague pelo Pix e avise por aqui: {link}".
5. **Variáveis ao enviar.** `{nome}` = primeiro nome do inquilino; `{valor}` = valor da cobrança (atrasada: total atualizado de hoje); `{vencimento}` = dd/mm; `{imóvel}` = "Unidade · Imóvel"; `{mês}` = mês da cobrança; `{pix}` = Pix copia-e-cola (vazio se não configurado); `{link}` = link da página pública **se já foi gerado, senão o Pix copia-e-cola** (mantém o comportamento de hoje: o link substitui o código) e vazio se nada existe.
6. **Escolha do modelo.** Dias até o vencimento = hoje (São Paulo) menos o vencimento (negativo antes). Vale o lembrete de **maior `offset_days` menor ou igual** a esse número; se a cobrança está mais cedo que todos, vale o de menor `offset_days`. Ex.: 5 dias antes usa o de -3; 4 dias depois usa o de +3; 12 dias depois, o de +10. A função é pura, no frontend, e o servidor só guarda.
7. **Diálogo de envio.** A página de detalhe busca os lembretes (`Promise.allSettled`), escolhe o modelo e passa `{name, body}` ao `SendChargeDialog`, que renderiza o texto e mostra "Modelo: {nome}" com link para Configurações. Quando o link é gerado, o texto é remontado do modelo (se o dono não o editou), como hoje. Se os lembretes não carregarem, usa `buildChargeMessage` (texto fixo).
8. **Tela `/settings/messages`.** Lista por dias ("3 dias antes do vencimento", "No dia do vencimento", "3 dias depois") com nome e "Editar"; "Adicionar lembrete" até 8; painel lateral com nome, quando (antes, no dia ou depois, mais quantos dias), texto com chips de variáveis que inserem na posição do cursor, prévia com dados de exemplo (Marina, novembro, Ap 302 · Ed. Aurora, R$ 1.850,00, 05/11) e "Remover" (a lista não pode ficar vazia). Salvar manda a lista inteira. Só o dono grava; os outros veem a lista.

## Risks / Trade-offs

- O texto editado e as variáveis são do dono: sem validação de conteúdo além das variáveis; o envio continua manual (o dono revisa antes de enviar).
- Quem já tem hábito do texto fixo vê o novo padrão (parecido); o dono pode editar na tela.
- Um modelo só por momento (dias únicos): simples e evita ambiguidade; mais de um por dia fica para depois.
- Lembretes em Hoje por agenda não entram: Hoje continua com as listas atuais, e "Cobrar" já abre o modelo certo.

## Migration Plan

Migration 000054 aditiva (tabela nova). Rollback: `down` apaga a tabela; o diálogo volta ao texto fixo.

## Open Questions

Nenhuma bloqueante.
