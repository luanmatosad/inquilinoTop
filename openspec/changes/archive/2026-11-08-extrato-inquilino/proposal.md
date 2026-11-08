## Why

O detalhe do inquilino mostra só o mês corrente. O canvas (seção 07) acrescenta o **Extrato**: tudo o que o inquilino pagou nos últimos 12 meses, se paga em dia e quanto está em atraso agora. É o que o dono consulta antes de renovar, reajustar ou negociar um atraso, e o que ele exporta quando o inquilino pede o histórico.

## What Changes

- Detalhe do inquilino ganha abas **Resumo** (a página de hoje, sem mudança de conteúdo) e **Extrato** (`/tenants/[id]/extrato`).
- Extrato: indicadores **Recebido no período**, **Pontualidade** ("X de Y pagos até o vencimento") e **Atrasos** (ou **Em atraso agora** com o total atualizado, quando há atraso); filtro **Últimos 12 meses**, ano corrente e **Personalizado** (`?periodo=`); tabela Mês, Vence em, Pago em, Valor e Situação (cards no celular), com "Mostrando N dos M meses" e **Ver todos**.
- Cartões **Contrato** (aluguel, dia de vencimento, próximo reajuste), **Reajustes** (quando e novo aluguel) e **Acordos** (cobranças que mudaram de vencimento).
- Ações **Exportar PDF** (impressão do navegador, como o recibo) e **Cobrar** (leva à cobrança aberta mais antiga com o envio aberto).
- Função pura `src/lib/tenant-statement.ts` (período, linhas, pontualidade, situação) com a junção feita no servidor Next.
- Fora desta etapa: aba **Documentos** (seção 11), "avisos" por cobrança (exigiria um evento por linha), PDF gerado no servidor, comparativo entre contratos.

## Capabilities

### New Capabilities
- `tenant-statement`: período, linhas, indicadores, pontualidade e situação do extrato do inquilino.

### Modified Capabilities
<!-- nenhuma: tenant-overview continua valendo para a lista e para o Resumo -->

## Impact

- Frontend: nova rota `app/tenants/[id]/extrato/page.tsx`, `components/tenants/TenantTabs.tsx` (usado também no Resumo), `lib/tenant-statement.ts`, testes; `app/tenants/[id]/page.tsx` só ganha as abas.
- Sem backend, sem migration, sem dependência nova: usa `GET /payments?lease_id&from&to`, `/leases` e `/leases/{id}/readjustments`.
