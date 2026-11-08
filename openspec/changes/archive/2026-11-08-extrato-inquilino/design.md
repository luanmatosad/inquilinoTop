## Context

Telas do canvas: `Inquilino-extrato`, `Inquilino-extrato-atraso` e `M-Extrato`. Estado atual, verificado no repo: o detalhe `/tenants/[id]` é uma página de cartões (cobrança do mês, contrato atual, observações, contato) que busca `/leases`, `/properties` e as cobranças do mês e atrasadas; `GET /payments` aceita `lease_id`, `from` e `to` e devolve `awaiting_confirmation`, `paid_date`, `net_amount`, multa e juros e `original_due_date` (marca de acordo); `GET /leases/{id}/readjustments` devolve `applied_at`, `old_amount` e `new_amount`; o recibo já usa `PrintButton` (impressão do navegador).

## Goals / Non-Goals

**Goals:** extrato fiel ao canvas (desktop e celular), com período, pontualidade e atraso atual; abas que não alteram o Resumo.
**Non-Goals:** aba Documentos, avisos por cobrança, PDF no servidor, endpoint novo, paginação.

## Decisions

1. **Rota própria e abas por link.** `/tenants/[id]/extrato` ao lado de `/tenants/[id]`; `TenantTabs` (links com `aria-current`) aparece nas duas. O Resumo não muda. Sem a aba Documentos, que é da seção 11.
2. **Quais cobranças.** Só `RENT` dos contratos do inquilino (todos, inclusive encerrados), com vencimento dentro do período. Uma busca `GET /payments?lease_id=&from=&to=` por contrato, em paralelo; contratos e reajustes degradam como no resto do app.
3. **Período por URL.** Padrão `12m`: do primeiro dia do mês de 11 meses atrás até o último dia do mês corrente em São Paulo (12 meses, incluindo o mês atual e cobranças ainda previstas, como no canvas). `?periodo=AAAA` = ano calendário. `?periodo=custom&de=AAAA-MM&ate=AAAA-MM` = personalizado (dois campos de mês num formulário GET); `de` depois de `ate` ou valor inválido cai em `12m`. O chip do ano mostra o ano corrente.
4. **Situação da linha.** `PAID` com `paid_date` até o vencimento: Pago; depois do vencimento: Pago com atraso; `LATE`: Atrasado; aviso pendente: Aguardando confirmação; resto: Previsto. Valor: líquido (`net_amount`) quando paga, senão o bruto.
5. **Indicadores.**
   - *Recebido:* soma do líquido das pagas do período ("N pagamentos").
   - *Pontualidade:* pagas em dia de pagas ("7 de 8"), com "N pago(s) com atraso" quando houver; sem pagamentos, "—".
   - *Terceiro cartão:* se há cobrança atrasada, **Em atraso agora** = soma do bruto com multa e juros das atrasadas ("N dias · mês" da mais antiga); senão **Atrasos** = quantidade de pagas com atraso no período ("0" se nenhuma).
6. **Contrato e reajustes.** Contrato atual do `tenant-overview` (aluguel, "vence todo dia N", próximo reajuste em MM/AAAA a partir de `next_readjustment`). Reajustes: do contrato atual, mais recente primeiro, "MM/AAAA, novo aluguel". Acordos: cobranças com `original_due_date` no período ("Acordo em {mês}: vencimento de dd/mm para dd/mm"); sem nenhuma, "Nenhum acordo registrado".
7. **Linhas visíveis.** Seis mais recentes primeiro (vencimento decrescente) e "Mostrando 6 dos 12 meses" com **Ver todos** (`?todos=1`). No celular, cards com a mesma regra.
8. **Ações.** Exportar PDF = `PrintButton` com estilos de impressão que escondem menu, abas e botões. Cobrar = `/financial/receivables/{id}?enviar=1` da cobrança aberta (não paga) mais antiga; sem cobrança aberta, o botão some.
9. **Cabeçalho.** Nome, "Unidade · Imóvel · contrato desde dd/mm/aaaa" e o `BillingBadge` do inquilino (Em dia, Com atraso), como no Resumo.

## Risks / Trade-offs

- Uma busca por contrato → inquilinos costumam ter 1 a 3 contratos; se crescer, agregar no backend.
- Pontualidade usa só `paid_date` e `due_date`; um acordo move o vencimento, então uma cobrança paga no novo prazo conta como em dia. É o comportamento do canvas ("o que foi combinado vale").
- Sem "avisos" por cobrança (um evento por linha); o aviso pendente aparece como situação.

## Migration Plan

Só frontend. Rollback: reverter o commit; o Resumo continua igual.

## Open Questions

Nenhuma bloqueante.
