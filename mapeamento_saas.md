# Mapeamento SaaS — Rentila (https://www.rentila.com.br/landlord/)

Engenharia reversa de caixa-preta, conta free, 2026-10-29. Somente leitura: nenhum formulário foi submetido.
Conta de teste: 1 unidade (`TESTE-001`), 1 inquilino, 0 aluguéis, 2 laudos rascunho.

## 1. Arquitetura observada

- SPA com **hash routing**: `/landlord/#<rota>`. Cada rota faz `GET /landlord/<rota>?a=1&rand=<n>` e recebe **HTML parcial** (server-rendered), injetado no container. Não há JSON REST nas telas principais.
- `rand` = cache-buster. `a=1` = flag de requisição AJAX.
- Gráficos: `GET /landlord/charts/income_expense?t=<ts>&chart_type=bar&y=2026`.
- Ações via POST em `/landlord/<modulo>/?action=<acao>` (ex.: `properties/?action=refreshStatuses`).
- Polling: `GET /landlord/signatures/checkNotClosed?check=<ts>`.
- Arquivos: `GET /landlord/mydocuments/getPropertyFilesList?propertyType=<tenant|lease|property>&id=<id>` (ou `&new=<token>` em criação).
- Extras de imóvel: `GET /landlord/properties/extras?type=1&PropertyID=<id>`.
- Auth: sessão por cookie (não inspecionado). Login Google ou e-mail/senha.
- Limitação: o MCP só mostra método/URL/status. Payloads de POST e corpos de resposta **não foram capturados**.

## 2. Mapa de rotas

| Menu | Rota hash | Endpoint (GET HTML) | Notas |
|---|---|---|---|
| Escritório | `#dashboard` | `/landlord/` | Onboarding 3 etapas (imóvel, inquilino, aluguel) |
| Propriedades > Unidades | `#properties` | `/landlord/properties` | KPIs + tabela |
| Unidade (ver/editar) | `#properties/{id}/view`, `#properties/{id}/edit` | `/landlord/properties/{id}/edit` | |
| Unidade (nova) | `#properties/new` | `/landlord/properties/new` | Redireciona p/ `#inscription?l=properties` se passar do limite |
| Propriedades > Edifícios | `#buildings` | `/landlord/buildings` | Rateio de encargos por fração |
| Inquilinos | `#tenants`, `#tenants/new` | `/landlord/tenants`, `/landlord/tenants/new` | |
| Aluguéis | `#leases`, `#leases/new` | `/landlord/leases`, `/landlord/leases/new` | |
| Laudo de vistoria | `#leases/handovers` | `/landlord/leases/handovers` | |
| Inventário | `#furniture` | `/landlord/furniture` | Móveis por imóvel |
| Finanças > Finanças | `#payments` | `/landlord/payments` | Transações (receitas/despesas) |
| Finanças > Financiamentos | `#credits` | `/landlord/credits` | Import Excel/CSV do cronograma |
| Finanças > Contas bancárias | `#bankimport/transactions` | `/landlord/bankimport/transactions` | Importação bancária |
| Finanças > Balanço | `#bilan` | `/landlord/bilan` (+ `charts/income_expense`) | Anual, para IR |
| Finanças > Projeções | `#forecast` | `/landlord/forecast` | Fluxo projetado 12 meses |
| Documentos > Meus documentos | `#mydocuments` | `/landlord/mydocuments` | Cota 50 MB (free) |
| Documentos > Meus modelos | `#templates` | `/landlord/templates` | **PRO** (modal de upgrade) |
| Documentos > Assinatura eletrônica | `#signatures` | `/landlord/signatures` | |
| Documentos > Modelos de carta | `#documents` | `/landlord/documents` | ~16 modelos |
| Mensagens | `#messages/inbox` | `/landlord/messages/inbox` | Inbox + enviadas |
| Contatos | `#contacts` | `/landlord/contacts` | |
| Candidatos | `#candidates` | `/landlord/candidates` | Abas: Todos/Em espera/Pré-seleção/Confirmados/Rejeitados |
| Ferramentas > Reajuste | `#leases/revision` | `/landlord/leases/revision` | Exige aluguel ativo |
| Ferramentas > Regularização de encargos | `#payments/regularisation` | `/landlord/payments/regularisation` | Exige aluguel ativo |
| Ferramentas > Equipamentos | `#equipment` | `/landlord/equipment` | |
| Ferramentas > Viagens | `#travel` | `/landlord/travel` | Deslocamentos de negócio (dedução) |
| Ferramentas > Leituras do medidor | `#meters` | `/landlord/meters` | |
| Ferramentas > Relatórios | `#reports` | `/landlord/reports` | Tipo + imóvel + período |
| Ferramentas > Simulador | `#simulator` | `/landlord/simulator` | Abas Imóvel único/Comparar/Cenários; modos Iniciante/Avançado/Especialista |
| Ferramentas > Índices | `#indices` | `/landlord/indices` | IGP-M mensal e acumulado |
| Comunidade | `#forum` | — | Não visitado |
| Notícias | `#news` | — | Não visitado |
| Lixo | `#trash` | `/landlord/trash` | Restaura em 7 dias; depois exclusão permanente |
| Agenda | `#agenda` | — | Não visitado |
| Perfil/config | `#profile/settings?tab=info3` | — | Não visitado |
| Assinatura | `#inscription` | `/landlord/inscription` | Planos Prata (até 5 imóveis) / Ouro (ilimitado); Pix, cartão, PayPal |

Padrão comum de listas: toggle **Ativo / Arquivos**, filtro, seletor de linhas (30/100), busca, ordenação, exportação, ação por linha. Botão "Novo X" no topo.

## 3. Modelo de dados implícito (nomes de campos dos forms)

### Property / Unidade (`Property*`, id numérico ex. 66931)
- `PropertyTypeID` (Apartamento, ...), `PropertyTitle` (ID/referência), `PropertyAvatarHexColor`
- Endereço: `PropertyAddress`, `PropertyAddress2`, `PropertyCity`, `PropertyPostalCode`, `PropertyState`, `PropertyCountry`
- Físico: `PropertySize` (m²), `PropertyRoomsNum`, `PropertyRoomsNumChambres`, `PropertyRoomsNumBaths`, `PropertyFurnished`, `PropertySmokers`, `PropertyAnimals`, `extras[]`, `PropertyParking`, `PropertyCave`
- Locação: `PropertyStatusManual`, `PropertyRentType`, `PropertyRentMinDuration`, `PropertyRentMaxDuration`, `PropertyRent`, `PropertyMaintenance`, `PropertyDeposit`, `PropertyBillingPeriod`, `PropertyOtherExpenses`
- Energia: `PropertyEnergyConsumption2`, `...Index2`, `...AmountFrom2/To2/Year2`
- Registro/fiscal: `PropertyRegistry`, `PropertyRegistrationNumber`, `PropertyCadastrePart`, `PropertySiret`, `PropertyFiscalCode`, `PropertyAnnualTax`
- Financeiro: `PropertyAcquisitionDate`, `PropertyInitialPrice`, `PropertyAcquisitionCosts`, `PropertyAgencyCosts`, `PropertyCurrentValue`, `PropertySalePrice`
- Outros: `PropertyComments`, fotos (`PropertyKeyDeletedPhotos[]`)
- Abas: Info gerais, adicionais, financeiras, chaves/códigos de acesso, certificados/seguros, folheto digital, fotos, contatos, documentos.
- KPIs da lista: alugado/não alugado, valor do aluguel, valor dos ativos, rentabilidade bruta/líquida acumulada, taxa de ocupação.
- Status visto: `Disponível`; visibilidade `Privado`.

### Building / Edifício
- Agrupa unidades; frações de copropriedade para ratear encargos comuns. Colunas: Edifício, Área, Unidades, Descrição.

### Tenant / Inquilino (`Tenant*`)
- Tipo: `TenantType` (Individual | Empresa/outros)
- Pessoal: `TenantTitle`, `TenantCivilState`, `TenantFirstName/MiddleName/LastName`, `TenantBirthDate`, `TenantBirthPlace`, `TenantNationality`, `TenantFiscalCode`, `TenantProfession`, `TenantRevenus`
- Identidade: `TenantIDType` (RG, passaporte, CNH, residência), `TenantIDNumber`, `TenantIDExpiry`, `TenantIDCard` (arquivo)
- Contato: `TenantEmail`, `send_invite` (convite de portal), `TenantEmailSecond`, `TenantMobilePhone(Nat)`, `TenantPhone(Nat)`
- Endereço: `TenantAddress1/2`, `TenantCity`, `TenantZip`, `TenantState`, `TenantCountry`, `TenantLeaveAddress`
- Empresa: `TenantCompanyName`, `TenantSiret`, `TenantCapital`, `TenantCompanyDescription`
- Profissional: `TenantPro*` (empregador, endereço, telefone)
- Bancário: `TenantBankCode`, `TenantBankAccountType`, `TenantBankBranchCode`, `TenantBankAccountNumber`, `TenantBankAccountVerificationNumber`
- Outros: `TenantNotes`, `TenantAvatarHexColor`, `TenantPhoto`
- Abas: Info gerais, adicionais, Fiadores, Contatos de emergência, Documentos.
- Lista: Inquilino, Tipo, Propriedade, Telefone, E-mail, Saldo, Status (ex.: "Sem e-mail"). KPIs: ativos, conectados, com/sem locação.

### Lease / Aluguel (`Lease*`)
- Vínculo: `PropertyID`, `LeaseTenantIds` (N inquilinos), `LeaseTitle`
- Tipo: `LeaseType` (residencial, temporada, não residencial, comercial, garagem, coworking, rural, outro), `LeaseReason`, `LeaseUsage` (principal, secundária, atividade profissional), `LeaseUsageActivity`
- Prazo: `LeaseStartDate`, `LeaseEndDate`, `LeaseDuration`, `LeaseDurationType`, `LeaseFixedAutoRenew`, `LeaseDueDate`
- Cobrança: `LeaseBillingPeriod` (mensal ... anual, valor fixo), `LeasePaymentArrears` (antecipado/vencido), `LeasePaymentMethodID`, `LeaseBoletoGeneration`, `LeaseBoletoProvider`, `LeaseDayToBePaid`, `LeasePaymentDay`, `LeasePaymentCreateDay`
- Valores: `LeaseRentHC` (+`TaxPercent`), `LeaseMaintenance` (encargos; +`TaxPercent`, `Type`, `Description`), `LeaseMonthlyAmount`, `LeaseIrpfType/Percent/Amount` (IRPF retido), `LeasePaymentItems_{ID,Amount,TaxPercent,Type,Description}[]` (itens extras)
- Primeira cobrança: `LeaseFirstBill`, `...EndDate`, `...Amount`, `...Charges`
- Caução: `LeaseSecurityDeposit`, `...Type`, `...Terms`, `...Doc`, `...Date`; `LeasePrepaidRent`
- Reajuste: `LeaseRentRevisionType/Percent/AmountType/Years/DateType/Date`, `LeaseIndexType`, `LeaseIndexValues`, `LeaseIndex`
- Limites/zonas: `LeaseLimitedZone`, `LeaseLimitedRent`, `LeaseRentReference(Maj)`, `LeaseRentSupplement(+Description)`
- Cláusulas: `LeaseSpecialTerms`, `LeaseSpecialClause`, `LeaseComments`, `leaseContract{Type,Text,Date,DateTo,ID}`
- Recibos: `LeaseIsOtherQuittanceAddress`, `LeaseOtherQuittanceAddress`, `LeaseMentionText`, `LeaseNumbering`, `LeaseNumberingPrefix`, `LeaseUseGlobalNumbering`, `LeasePaymentReceivedComments`, `LeasePaymentAvisComments`, `LeaseSoldeReport`
- Notificações: `LeaseRentNotifyLandlord/Tenant`, `LeaseAnniversaryNotifyLandlord/Tenant`, `LeaseLateRentNotifyTenant`
- Controle: `LeaseDraft`, `LeaseActive`, `gen_lease_payments` (gera cobranças), `LeaseBailDocumentID`
- Abas: Info gerais, adicionais, Recibos, Outras configurações, Fiadores, Seguro, Documentos, Assinatura.
- Lista: Propriedade, Tipo, Inquilino, Aluguel, Encargos, Caução, Duração, Status, Modelos, Ações.

### Payment / Transação (`#payments`)
- Colunas: Data, Propriedade, De/a, Valor, Descrição, Status. Filtros: período, imóvel, aluguel, tipo, status.
- Totais: receitas, despesas, rendimento líquido. Ação: "Nova transação" (receita ou despesa). Despesa recorrente tipo "Crédito" = financiamento.

### Demais entidades (só colunas das listas)
- **Handover/Laudo**: ID, Tipo (entrada/saída), Propriedade, Inquilino, Criou o, Modelo. Estado "rascunho".
- **Furniture/Inventário**: ID, Propriedade, Valor, Inquilino, Criou o, Modelo.
- **Credit/Financiamento**: juros pagos, seguro pago, capital reembolsado, remanescentes.
- **BankImport/Transação bancária**: Data, Valor, Descrição, Resumo da conta, Correspondência (conciliação).
- **Document**: Arquivo, Propriedade, Descrição, Compartilhar com, Tamanho, Data.
- **Signature**: Descrição, Documentos, Signatários, Data, Status.
- **Contact**: Sobrenome, Telefone, E-mail, Propriedades, Inquilinos, Compartilhar.
- **Candidate**: Candidato, Propriedade, Telefone, E-mail, Receitas, Data, Status.
- **Equipment**: Tipo, Propriedade, Data da compra, Preço, Garantia, Status.
- **Travel**: Propriedade, Data, Distância, Preço, Descrição.
- **Meter**: Propriedade, Inquilinos, Medidor, Tipo, Data, Consumo, Preço.
- **Message**: inbox/enviadas, mensagens internas proprietário-inquilino.
- **Trash**: Título, Data, Tipo (soft-delete).

## 4. Relacionamentos

```
Landlord (conta)
 ├─ Building 1─N Property(Unidade)
 ├─ Property 1─N Lease ─N─N Tenant (LeaseTenantIds)
 │    ├─ Payment (cobranças geradas por gen_lease_payments)
 │    ├─ Handover (laudo), Furniture (inventário), Document, Signature
 │    └─ Guarantor(Fiador), Insurance(Seguro)
 ├─ Property 1─N Equipment / Meter / Travel / Document / Contact
 ├─ Credit (financiamento) → Payment (despesa recorrente)
 └─ BankImport Transaction ↔ Payment (conciliação)
```

## 5. Regras de negócio observadas

1. **Onboarding**: imóvel → inquilino → aluguel (barra de progresso 2/3).
2. **Plano free limitado**: ao exceder o limite de propriedades, `#properties/new` redireciona para `#inscription?l=properties` com aviso. Planos: Prata (5 imóveis), Ouro (ilimitado). Aviso lista inquilinos, aluguéis, visitantes e multiusuários ilimitados como PRO. "Meus modelos" é PRO. Cota de documentos: 50 MB.
3. **Aluguel exige imóvel e inquilino**. O select de imóveis lista só unidades existentes. Reajuste e regularização de encargos exigem aluguel ativo.
4. **Aluguel gera cobranças e recibos automaticamente** (texto da tela: "aluguéis e recibos são gerados automaticamente na seção Finanças"). Um contrato por imóvel alugado por inquilino.
5. **Reajuste** por índice (IGP-M exibido em `#indices`), percentual ou valor, a cada N anos, em data definida.
6. **Boleto**: campos de geração e provedor; método de pagamento por aluguel.
7. **IRPF retido** configurável por aluguel (tipo/percentual/valor).
8. **Soft-delete**: itens excluídos vão ao Lixo, restauráveis por 7 dias; depois exclusão permanente. "Arquivos" separa itens arquivados de ativos.
9. **Convite ao inquilino**: `send_invite` cria acesso ao portal ("Conectados" nos KPIs). Status "Sem e-mail" quando não há e-mail.
10. **Edifício**: usa unidades já criadas; frações de copropriedade ratearem encargos comuns.
11. **Balanço**: dados "somente para referência", apoio ao imposto de renda. Projeções: 12 meses, com despesas pontuais estimadas.
12. **Laudos**: modelo de entrada/saída, estado rascunho, vinculado a imóvel e inquilino (ambos opcionais no rascunho).
13. Financiamento: importa cronograma por Excel/Open Office/CSV ou PDF; só o último pagamento gerado pode ser removido.

## 6. Lacunas / próximos passos

- Payloads de POST/PUT e respostas não capturados (MCP expõe só método/URL/status). Sugestão: HAR do DevTools para `properties`, `tenants`, `leases`, `payments`.
- Não visitados: `#agenda`, `#forum`, `#news`, `#profile/settings`, abas Fiadores/Seguro/Assinatura do aluguel, aba Fiadores/Contatos do inquilino, modais de "Nova transação".
- Fluxo de cobrança (boleto) e portal do inquilino só com submissão real; evitado por ser escrita em conta real.

## 7. Cruzamento Rentila × domínio Go (InquilinoTop)

Fonte Go: `backend/internal/*/model.go` + migrations até `000035`. Rentila é "tudo para proprietário PF"; InquilinoTop é multi-tenant por `organization_id` com RBAC, auditoria e fiscal.

### 7.1 Entidades

| Rentila | Go | Status | Gap |
|---|---|---|---|
| Property/Unidade | `property.Property` + `Unit` | Parcial | Rentila junta imóvel e unidade em 1 registro. Go separa (RESIDENTIAL/SINGLE). Faltam em Go: CEP, país, área, quartos/banheiros, mobiliado, fumantes/animais, extras, estacionamento, dados de aquisição/valor atual, matrícula/IPTU cadastral, fotos, status manual, valor de aluguel alvo |
| Building/Edifício | `Property` tipo RESIDENTIAL (≈) | Parcial | Sem frações de copropriedade nem rateio de encargos comuns |
| Tenant | `tenant.Tenant` | Parcial | Go tem só nome, e-mail, telefone, documento, PF/PJ. Faltam: estado civil, nascimento, profissão, renda, tipo/nº de documento, endereço, dados de empresa, dados bancários, contatos de emergência, fiadores, foto, notas, convite ao portal |
| Lease | `lease.Lease` | Parcial | Go: 1 unidade + 1 inquilino, aluguel, caução, dia de pagamento, multa, juros, IPTU. Faltam: N inquilinos, tipo de contrato, uso, renovação automática, periodicidade, itens extras/encargos, valor de condomínio, IRPF por contrato, 1ª cobrança proporcional, tipo de caução, aluguel antecipado, cláusulas, numeração de recibo, notificações |
| Payment | `payment.Payment` | **Go à frente** | Go tem competência, multa, juros, IRRF, líquido, cobrança PIX/BOLETO/TED, repasse (payout). Rentila é só lançamento manual + boleto opcional |
| Expense (transação despesa) | `expense.Expense` | Parcial | Go: categorias fixas por unidade. Faltam: recorrência, rateio por edifício, vínculo com financiamento, anexo |
| Documents | `document.Document` | Parcial | Go: upload por entidade (property/unit/lease/tenant), 10 MB. Faltam: compartilhar com inquilino, cota por plano, modelos de carta |
| Reajuste + Índices | `lease.IndexValue`, `AdjustLeaseInput`, `lease_readjustments` | Equivalente | Go tem histórico de índices (migration 25) e reajuste por índice. Falta conferir cobertura (IGP-M, IPCA) e agenda automática de revisão |
| Balanço / Relatórios (IR) | `fiscal.AnnualReport`, `IRRFBracket` | **Go à frente** | Go calcula IRRF por faixa, separa PF/PJ, IPTU dedutível. Rentila só dá balanço de referência |
| Dashboard | `dashboard.Metrics` | Equivalente | Go: receita mensal, pagamentos recentes, contratos a vencer. Rentila adiciona rentabilidade bruta/líquida, taxa de ocupação, valor dos ativos |
| Mensagens/notificações | `notification` | Parcial | Go notifica por e-mail. Rentila tem inbox interno proprietário↔inquilino |
| Lixo / soft-delete | `is_active=false` (ADR 0001) | Parcial | Go não tem tela de lixo nem janela de 7 dias de restauração |
| Contas/boleto | `payment.FinancialConfig` (ASAAS, BRADESCO, ITAU, SICOOB, MOCK) | **Go à frente** | Multi-provedor + chave PIX + dados bancários |
| Planos / limites | — | **Ausente** | Sem Prata/Ouro nem limite de imóveis |
| Multiusuário/equipe | `organization`, `rbac`, `Member`, `Invite` | **Go à frente** | Rentila trata multiusuário como PRO |
| Auditoria, 2FA, suporte | `audit`, `identity` (2FA), `support` | **Go à frente** | Não vistos na Rentila |
| Import/export | `importexport` | Equivalente | Rentila importa financiamento e extrato bancário |

### 7.2 Ausentes no Go (candidatos a backlog)

Ordenado por valor provável para o público do InquilinoTop (locação residencial BR):

1. **Laudo de vistoria** (entrada/saída) + **Inventário** de móveis. Alto valor, ligados a `lease`.
2. **Conciliação bancária** (importar extrato, casar com `payment`). Reaproveita `importexport` e `payment`.
3. **Assinatura eletrônica** de contrato. Depende de `document`.
4. **Candidatos** (funil de locação: espera/pré-seleção/confirmado/rejeitado). Pode alimentar `tenant`.
5. **Fiadores e seguro-fiança** no aluguel. Obrigatórios em prática no Brasil.
6. **Modelos de contrato/carta** (cobrança em atraso, quitação, rescisão).
7. **Financiamento** do imóvel (juros, capital, saldo).
8. **Leituras de medidor** (água/luz) com repasse ao inquilino. Liga com `expense`.
9. **Equipamentos**, **viagens**, **simulador de investimento**, **projeção de fluxo de caixa**.
10. **Edifício com rateio** de encargos comuns.
11. **Lixo** com restauração.

### 7.3 Divergências a decidir

- **`owner_id` vs `organization_id`.** `.claude/rules/domain-model.md` manda filtrar por `owner_id`. Os models Go usam `organization_id` (migrations 31 a 34). `Lease` tem os dois. Atualizar a regra para refletir o modelo real, ou documentar quando usar cada um.
- **Property+Unit.** Rentila usa um único nível; Go tem dois e auto-cria "Unidade 01" em SINGLE. Mantém a invariante, mas o formulário do frontend precisa esconder a unidade para SINGLE.
- **Lease com 1 inquilino.** Rentila permite vários (coinquilinos). Decidir se vira tabela `lease_tenants` (migração com impacto em `payment`, `fiscal` e receitas).
- **Enums.** `Payment.status` não tem `CANCELED` nem parcial; Rentila permite pagamento parcial. `Expense.category` é fechado em 6 valores; Rentila aceita tipos livres e financiamento.
- **Estado civil/documento.** `Tenant.person_type` PF/PJ já cobre a escolha Individual/Empresa. Dados de PJ (razão social, capital) não existem.

### 7.4 Lacunas na própria análise

- Só li `model.go`; não verifiquei `handler.go` (rotas reais) nem os CLAUDE.md dos módulos. A coluna "Gap" aponta campos dos models, não funcionalidades eventualmente existentes em services.
- Status de frontend por módulo está no CLAUDE.md raiz (property, tenant, lease, payment, expense ainda em Supabase). Isso não entrou no cruzamento.
