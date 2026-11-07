## Context

Telas do canvas: `Contratos-vazia`, `Contratos-lista`, `Contratos-criar` (painel), `Contrato-detalhe`, `Contrato-encerrar` (modal), `Reajuste-aplicar` (painel), `M-Contratos`, `M-Contrato-detalhe`; o aditivo (`Aditivo-1/2/3`) fica fora. Estado atual, verificado no repo:

- **`Lease`** tem `unit_id`, `tenant_id`, `start_date`, `end_date`, `rent_amount`, `deposit_amount`, `payment_day`, `status` (`ACTIVE`, `ENDED`, `CANCELED`), `late_fee_percent` (percentual, 2 = 2%), `daily_interest_percent` (percentual **por dia**, máximo 10), IPTU e `notes`. Não há índice nem mês de reajuste.
- **Encerrar:** `POST /leases/{id}/end` não recebe corpo; o SQL faz `end_date = LEAST(COALESCE(end_date, hoje), hoje)` e cancela as futuras com `CancelFuturePending(after = hoje)`.
- **Reajustar:** `POST /leases/{id}/readjust` recebe `percentage` como **fração** (0,05 = 5%, máximo 1), `index_name`, `applied_at` e `notes`; atualiza o aluguel do contrato e grava o histórico. O frontend já converte porcentagem em fração (`readjustSchema`). Não toca nas cobranças já geradas. Há também `POST /leases/{id}/adjust` (reajuste automático por índice) e a tabela de índices (IPCA, IGP-M).
- **Cobranças:** são imutáveis no sentido do ADR `payment-0001` (nada é removido; correção é por `Update`). `GenerateMonth` é idempotente pelo índice único `(lease_id, competency, type)`, que **inclui linhas inativas**: não dá para desativar e recriar. Um `RENT` pendente guarda `gross_amount` igual ao aluguel; IRRF e valor líquido só são calculados no pagamento, e `LATE` é calculado na listagem.
- **Documentos:** módulo `document` com `entity_type` `lease`, upload multipart (`ParseMultipartForm(10 << 20)`), listar, baixar e excluir.
- **Update do contrato** (`PUT /leases/{id}`) é substituição total, como em Inquilinos: campos omitidos viram `NULL`.
- **Frontend:** `/leases` (lista com `CreateLeaseDialog`), `/leases/[id]` (abas), `LeaseForm` (inclui caução, multa %, juros diários %, IPTU), `LeaseActions` (Dialogs de renovar, reajustar e encerrar). `readjustSchema` e `getActiveTenants`/`getActivePropertiesWithUnits` já existem.
- **Padrão das ondas anteriores:** painel `Sheet` por URL, junção no servidor Next por função pura, degradação quando uma busca opcional falha, tabela no desktop e cards no celular.

## Goals / Non-Goals

**Goals:**
- Telas de Contratos fiéis ao canvas (exceto aditivo), no desktop e no celular.
- "Próx. reajuste" confiável na lista, no detalhe e no indicador, com índice e mês gravados no contrato.
- Encerrar com data de saída e motivo.
- Reajustar de forma que a frase do canvas seja verdadeira: as cobranças futuras passam a usar o novo valor.
- Editar um contrato nunca apagar dados que a tela não mostra.

**Non-Goals:**
- Aditivo e geração de PDF.
- Regras de multa e juros por organização.
- Pix ("Recebe em"), "Aguardando confirmação", fiador.
- Paginação das listas.

## Decisions

**1. `adjustment_index`, `adjustment_month` e `end_reason` no contrato (migration `000048`).**
`adjustment_index VARCHAR(10)` com `CHECK` em `IGP-M`/`IPCA` (nulo = sem índice definido), `adjustment_month SMALLINT` com `CHECK` entre 1 e 12, `end_reason VARCHAR(30)` com `CHECK` em `TERM_END`, `TENANT_REQUEST`, `NONPAYMENT`, `OWNER_REQUEST`, `OTHER`. Backfill: `adjustment_month = EXTRACT(MONTH FROM start_date)`. Ao criar sem informar o mês, o serviço usa o mês de `start_date`. Alternativa descartada: guardar só o índice e derivar o mês do início; o canvas tem "Reajustar em" como campo editável.

**2. `next_readjustment` calculado no Go.**
Campo `next_readjustment` (data, sempre dia 1) devolvido em `GET /leases` e `GET /leases/{id}`, para os dois consumidores terem a mesma regra, em `NextReadjustment(month, start, lastApplied)` (função pura). Sem reajuste aplicado: o primeiro mês de reajuste pelo menos 12 meses depois do início. Com reajuste aplicado depois do início: o ciclo do mês de reajuste **mais próximo da data aplicada** (empate vale o anterior) mais 12 meses. A regra inicial, "12 meses depois do último reajuste", foi descartada na implementação: um reajuste aplicado com um mês de atraso empurraria o próximo para 23 meses depois. Contrato sem histórico cujo aniversário já passou aparece com a data no passado, que a tela marca como "reajuste pendente". O repositório traz o último `applied_at` por contrato numa subconsulta dentro das colunas do contrato, sem N+1. Alternativa descartada: calcular no frontend, que exigiria um endpoint de reajustes de todos os contratos.

**3. Encerrar com data e motivo.**
Corpo opcional `{ "end_date": "YYYY-MM-DD", "reason": "..." }`. Sem corpo, o comportamento atual (hoje, sem motivo) continua valendo, então clientes antigos não quebram. Regras: `end_date` anterior a `start_date` → 422 `ErrInvalidDates`; a semântica `LEAST` com o fim previsto é mantida (a saída nunca estende o prazo); `reason` fora da lista → 400. As cobranças futuras são canceladas a partir da data informada (`CancelFuturePending(after = end_date)`). Data de saída no passado é aceita, e a tela avisa que cobranças com vencimento depois dela também serão canceladas.

**4. Reajuste atualiza as cobranças futuras (ADR `payment-0004`).**
`PaymentHooks` ganha `ReadjustFuturePending(ctx, leaseID, orgID, from, newAmount)`. O serviço e o repositório de `payment` fazem um `UPDATE payments SET gross_amount=$new, updated_at=NOW()` nas linhas `type='RENT'`, `status='PENDING'`, `is_active=true`, `charge_id IS NULL` e `due_date >= from` (data do reajuste). `EXPENSE` (IPTU) não muda. As com `charge_id` são contadas em `needs_review`. `ReadjustOutput` passa a incluir `payments_updated`, `payments_need_review` e `payments_error`. Se a atualização falhar, o reajuste do contrato **não** é desfeito (mesmo critério do encerramento): o erro vai na resposta e o log registra. É atualização, não remoção, então respeita o `payment-0001`. Alternativas descartadas: desativar e regenerar (o índice único conta linhas inativas) e manter as futuras no valor antigo (deixa 11 meses errados depois de um reajuste).

**5. Aluguel de referência da unidade (migration `000047`).**
`units.reference_rent NUMERIC(12,2)` opcional, `>= 0`. Aparece no formulário de unidade ("Aluguel de referência (opcional)", com a dica "Aparece como sugestão ao criar o contrato.") e pré-preenche o aluguel no painel de contrato quando o campo está vazio.

**6. Multa e juros: tela em % ao mês, banco em % ao dia.**
`monthlyToDaily(m) = m / 30` e `dailyToMonthly(d) = d * 30`, ambos arredondados (diário a 6 casas, mensal a 2). 1% ao mês grava 0,033333% ao dia e volta como 1,00%. A conta de juros do backend não muda. O formulário usa os padrões fixos do canvas (multa 2%, juros 1% ao mês), sob o texto "Padrão: multa de 2% e juros de 1% ao mês" com "Alterar neste contrato" para abrir os campos. Não dizemos "suas regras" porque as regras por organização não existem. A precisão da coluna `daily_interest_percent` é conferida na primeira tarefa.

**7. Painéis por URL, como em Imóveis e Inquilinos.**
Lista: `?novo=1` (aceita `&inquilino=<id>` e `&unidade=<id>`). Detalhe: `?editar=1`, `?encerrar=1`, `?reajustar=1`. Criar/Editar/Reajustar em `Sheet`; Encerrar em `Dialog` (o canvas é um modal). Painel único, não assistente, conforme a artboard.

**8. Edição preserva o que a tela não mostra.**
`PUT /leases/{id}` apaga os omitidos, e o formulário não mostra a caução. `preserveLeaseFields(values, initial)` devolve `deposit_amount`, `annual_iptu_amount`, `iptu_year` e `status` do contrato atual. Só os campos de `UpdateLeaseInput` são editáveis (unidade, inquilino e início ficam fixos, e o painel os mostra como texto).

**9. Lista: junção no servidor.**
`buildLeaseRows(leases, tenants, properties)` em `src/lib/lease-overview.ts` devolve linhas e indicadores. Buscas em paralelo (`Promise.allSettled`): `/leases` (obrigatória), `/tenants` e `/properties`; se uma opcional falhar, a coluna vira "—" com aviso. Indicadores: **Ativos** = contratos `ACTIVE` e soma do aluguel; **Vencendo em 30 dias** = `ACTIVE` com `end_date` nos próximos 30 dias; **Reajuste em 90 dias** = `ACTIVE` com `next_readjustment` entre hoje e 90 dias; **Encerrados** = `ENDED`. Datas "de hoje" no fuso `America/Sao_Paulo`.

**10. Detalhe.**
Busca em paralelo: contrato (obrigatória), `/leases/{id}/payments`, `/leases/{id}/readjustments`, inquilino, imóveis e documentos do contrato. Cobranças: as 4 `RENT` de vencimento mais recente, com "Mostrando as 4 mais recentes de N" e "Ver todas" para `/financial/receivables`; situação Pago, Atrasado ou Previsto. Histórico: uma linha "Início" com o aluguel original (o `old_amount` do primeiro reajuste, ou o aluguel atual se não houver) mais um linha por reajuste (`applied_at` em MM/AAAA, índice, percentual, novo aluguel). Termos, Partes e Documentos como no canvas, sem "Recebe em". Os botões "Criar aditivo" e "Renovar" não aparecem.

**11. Contrato assinado (documentos).**
Server Action envia o PDF para `/api/v1/documents` (`entity_type=lease`); a listagem e o download passam por uma rota do Next que repassa o cookie de sessão, como a das fotos de laudo. Limite de 10 MB e só PDF, validados na tela e conferidos no backend na primeira tarefa.

**12. Reajuste em painel.**
Campos: contrato (texto), "Aniversário do contrato" (`next_readjustment` ou início), aluguel atual, índice (padrão o do contrato), percentual manual (>= 0,1% e <= 100%), data de vigência (padrão a data do aniversário) e prévia do novo aluguel com o aumento. Após aplicar, o toast informa quantas cobranças foram atualizadas e quantas precisam de revisão. "Avisar o inquilino pelo WhatsApp" abre `wa.me` com a mensagem pronta (reaproveita `whatsappUrl`) depois do sucesso.

**13. "Criar contrato" do inquilino.**
O botão do detalhe do inquilino passa a apontar para `/leases?novo=1&inquilino=<id>`. Muda o código e o teste do detalhe do inquilino, não a spec.

## Risks / Trade-offs

- [Reajuste altera valores de cobranças] → Só `RENT` + `PENDING` + sem cobrança emitida + vencimento a partir da data do reajuste; testes de repositório para cada exclusão (pago, emitido, `EXPENSE`, antes da data, outro contrato); resposta com contagens; ADR registrando a regra.
- [Reajuste do contrato e das cobranças em duas etapas] → Falha na segunda não desfaz a primeira (mesmo critério do encerramento); a resposta e o log expõem o erro, e a tela avisa para revisar as cobranças.
- [Data de saída no passado cancela cobranças já vencidas] → A tela avisa; o corpo é validado (não antes do início); e o cancelamento só atinge `PENDING` sem cobrança emitida.
- [Conversão mensal para diária perde precisão] → 6 casas decimais no diário; teste de ida e volta; o cálculo de juros do backend não muda.
- [`PUT` do contrato apaga omitidos] → `preserveLeaseFields`, com teste que confere o corpo enviado.
- [`next_readjustment` passado em contrato sem histórico] → A tela mostra "reajuste pendente" em vez de uma data enganosa; não entra no indicador de 90 dias.
- [Listas sem paginação] → Mesma dívida das ondas anteriores.
- [Migrations com `CHECK`] → `down` remove colunas e constraints; sem dados a converter, porque são colunas novas.
- [Upload de PDF] → Limite e tipo validados nos dois lados; o contrato assinado é opcional.

## Migration Plan

1. Migrations `000047` (unidade) e `000048` (contrato), compatíveis com linhas atuais, sobem com o backend.
2. Backend com os novos campos, `next_readjustment`, `End` com corpo opcional e `Readjust` atualizando as futuras. `POST /end` sem corpo continua igual, então o deploy do backend antes do frontend é seguro.
3. Frontend. Rollback do frontend não exige rollback do banco.

## Decisões da leitura do canvas e do código (tarefas 1.1 a 1.4)

- **Estado vazio (`Contratos-vazia`):** a busca "Buscar por inquilino ou unidade", "Filtros" e "Criar contrato" continuam visíveis; abaixo, bloco `muted` com ícone, "Nenhum contrato ainda", "Um contrato liga uma unidade a um inquilino e gera as cobranças de cada mês." e botão outline "Criar contrato".
- **Lista mobile (`M-Contratos`):** linha-resumo "5 ativos · R$ 8.300,00 por mês", busca, cards com "Unidade · Imóvel" em destaque, o inquilino embaixo, o aluguel à direita e "Próx. reajuste MM/AAAA"; botão fixo "Criar contrato". Sem selo de situação nem indicadores no celular.
- **Detalhe mobile (`M-Contrato-detalhe`):** barra com voltar e o nome da unidade; cartão com "Imóvel · Inquilino" e o selo, o aluguel grande e "todo dia 5 · período"; cartões Termos e Cobranças (3 recentes e "Ver todas (N)"); botões "Reajustar aluguel" e "Encerrar contrato" no fim. Não traz histórico de reajustes nem documentos. Seguimos o desktop responsivo (seções empilhadas), que é um superconjunto.
- **Juros (1.2):** `daily_interest_percent` é `FLOAT8` (migration `000010`), então seis casas decimais cabem sem mudança.
- **Upload (1.3):** o backend valida `size_bytes` entre 1 e 10 MB e aceita só `application/pdf`, `application/msword` e `.docx`; a tela aceita só PDF (o canvas diz "PDF, até 10 MB"). Os documentos são escopados por **`owner_id` (o usuário), não pela organização**: um anexo enviado por um membro não aparece para outro. Segue o comportamento atual do módulo; fica registrado como dívida e não muda aqui.
- **Usos (1.4):** `CreateLeaseDialog`, `LeaseForm`, `LeaseActions` e `ActiveLeaseCard` são usados também por **`/units/[id]`** (card do contrato ativo e botão de criar contrato na unidade vaga). A página de unidade passa a mostrar um resumo simples do contrato com link para `/leases/<id>` e, na unidade vaga, um link "Criar contrato" para `/leases?novo=1&unidade=<id>`. Só então esses componentes saem.
- **Composição (1.4):** os ganchos de cobrança são montados em `cmd/api/main.go:125` (`leaseSvc.WithPayments(payment.NewLeaseHooks(paymentSvc))`).

## Open Questions

- Como o reajuste automático (`/adjust`) escolhe o período do índice e se deve atualizar as cobranças futuras (tarefa 5.4).
- Lista exata de motivos de encerramento além de "Fim do prazo": a proposta usa cinco valores e pode ser ajustada.
