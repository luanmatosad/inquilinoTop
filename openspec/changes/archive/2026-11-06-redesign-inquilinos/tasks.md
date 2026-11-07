## 1. Ler o canvas e fechar as perguntas abertas

- [x] 1.1 Ler `Inquilinos-vazia`, `M-Inquilinos`, `M-Inquilino-cadastrar` e `M-Inquilino-detalhe` no canvas e registrar no `design.md` o estado vazio, o desenho mobile e qualquer divergência do desktop
- [x] 1.2 Confirmar no backend que `GET /payments?status=LATE` já considera a data de hoje (pagamento vencido e não pago) e que `GET /payments?from&to` devolve o aluguel do mês; anotar o resultado no `design.md`
- [x] 1.3 Buscar usos de `TenantListClient`, `TenantForm` e `TenantFormData` no frontend e listar o que precisa mudar

## 2. Módulos puros (specs tenant-overview e Documento mascarado)

- [x] 2.1 Testes de `buildTenantOverview`: contrato atual (`ACTIVE`, mais recente), sem contrato, imóvel e unidade, unidade ausente, situação Atrasado/Pago/Previsto/"—", `RENT` × outros tipos, lista vazia
- [x] 2.2 Testes de `currentMonthRange`: mês corrente em `America/Sao_Paulo`, inclusive 23h do último dia com UTC já no mês seguinte
- [x] 2.3 Implementar `src/lib/tenant-overview.ts` (função pura) e `currentMonthRange`
- [x] 2.4 Testes e implementação de `maskDocumentPartial` (CPF `123.456.***-09`, CNPJ `12.345.***/0001-90`, vazio, formato inesperado)
- [x] 2.5 Testes e implementação de `whatsappUrl` (com máscara, já com 55, curto demais, vazio)
- [x] 2.6 Teste e helper que monta o corpo da edição preservando `postal_code`, `address_line`, `city` e `state` de `initialData`

## 3. Formulário e painel (specs Cadastro rápido, Edição que preserva o endereço, Exclusão)

- [x] 3.1 Testes do `TenantForm`: campos do canvas, rótulos PF/Empresa, dica do celular, sem endereço nem fiador, CPF inválido mostra erro, duplicidade aparece no campo documento
- [x] 3.2 Teste da edição: valores atuais, corpo enviado contém o endereço antigo mesmo sem exibi-lo, e alterar só o e-mail não zera o endereço
- [x] 3.3 Refazer `TenantForm` no layout do canvas e com campos ocultos de endereço apenas na edição
- [x] 3.4 Testes do `TenantFormSheet`: abre por `?novo=1` e `?editar=1`, fecha tirando só o parâmetro, mantém aberto com erro de validação, "Excluir inquilino" com confirmação, mensagem do contrato ativo
- [x] 3.5 Implementar `TenantFormSheet` (estado local mais ajuste na renderização) e a exclusão no rodapé. O mapeamento de `TENANT_HAS_ACTIVE_LEASE` já existia em `actions.ts`

## 4. Lista de inquilinos (specs Lista, tenant-overview)

- [x] 4.1 Testes da página: colunas, linha de exemplo com documento mascarado, "Sem contrato" e "—", busca por nome/e-mail/documento, filtro `?cobranca=`, botão Importar, estado vazio, "Nenhum inquilino encontrado.", erro com nova tentativa, degradação sem pagamentos e sem contratos, e que o documento completo não está no HTML
- [x] 4.2 Buscar inquilinos, contratos, imóveis e pagamentos (mês e `LATE`) em paralelo; erro de inquilinos é erro da tela
- [x] 4.3 Implementar tabela, cards no celular, busca, filtro, rodapé com contagem e botão Cadastrar inquilino (`?novo=1`)

## 5. Detalhe do inquilino (spec Detalhe)

- [x] 5.1 Testes do detalhe: cabeçalho, cartões Cobrança do mês e Contrato atual, "Vence todo dia N", observações opcionais, estado sem contrato com "Criar contrato", botão WhatsApp, 404, painel de edição por `?editar=1` e documento completo só nele
- [x] 5.2 Reescrever `[id]/page.tsx` sem abas e sem histórico de contratos, usando `buildTenantOverview` para um inquilino
- [x] 5.3 Selo de situação, "Ver cobrança" (`/financial/receivables`), "Ver contrato" (`/leases/<id>`) e "Criar contrato" (`/leases`)

## 6. Limpeza

- [x] 6.1 Remover `TenantListClient` e o `TenantForm` antigo e conferir que nada mais os referencia
- [x] 6.2 Nenhum teste dependia do formulário antigo; `tenantSchema` e as ações seguem inalterados, e o teste de `schemas` continua passando

## 7. Verificação

- [x] 7.1 Rodar `make frontend-lint` e a suíte Vitest completa; tudo verde
- [x] 7.2 Frontend reconstruído e percorrido no navegador (sessão do próprio usuário, só leitura): lista, detalhe com contrato e painel de cadastro, no desktop. **Não verificados no navegador:** celular a 390px (o redimensionamento da janela não surtiu efeito), tema escuro, detalhe sem contrato, edição e exclusão. Todos têm cobertura em teste, e o painel de edição não foi aberto para não expor o documento real de um inquilino
- [x] 7.3 Conferir pela API com o usuário de teste: criar PF e PJ, editar sem perder o endereço, documento duplicado (409), excluir com e sem contrato ativo
- [x] 7.4 `frontend/CLAUDE.md` atualizado. `backend/internal/tenant/CLAUDE.md` não menciona as telas, então ficou como está
