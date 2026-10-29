## Context

- Go: `property.Property` (type, name, address_line, city, state), `Unit` (label, floor, notes), `tenant.Tenant` (name, email, phone, document, person_type). Repositórios já expõem `GetByField(orgID, field, value)`, mas nenhum service o usa para impedir duplicidade.
- Frontend: Go API via `lib/go` e DAL em `src/data/owner/*`. Existem duas árvores de rotas para os mesmos dados; o `Sidebar` aponta para `/properties` e `/tenants`.
- Modelos novos usam `organization_id` (ADR rbac-0002); SINGLE auto-cria "Unidade 01" (ADR property-0001); soft-delete obrigatório.
- Referência de campos: `mapeamento_saas.md` (Rentila), tomando só o essencial para locação residencial.

## Goals / Non-Goals

**Goals:**
- Cadastro suficiente para sustentar contrato e cobrança.
- Evitar duplicidade de inquilino e de unidade.
- Uma única árvore de rotas no frontend.

**Non-Goals:**
- Dados de aquisição, matrícula, fotos, edifícios, fiadores, portal do inquilino.
- Busca de endereço por CEP externo (ViaCEP). Pode vir depois.

## Decisions

### D1. Campos novos opcionais
Todas as colunas novas são nullable para não quebrar dados e clientes atuais. `state` continua `max=2`. `postal_code` aceita 8 dígitos, normalizado sem máscara. Alternativa: tornar obrigatório. Rejeitada: impede importação (`importexport`) de planilhas incompletas.

### D2. Documento validado e único por organização
Novo `pkg/document` (nome a confirmar para não colidir com `internal/document`) com `ValidCPF`/`ValidCNPJ`. O service valida conforme `person_type` (PF→CPF, PJ→CNPJ) e consulta `GetByField` antes de criar/atualizar. Armazena apenas dígitos. Índice único parcial `(organization_id, document) WHERE is_active AND document IS NOT NULL` como rede de segurança contra corrida. Alternativa: só índice. Rejeitada: o erro do banco não dá mensagem amigável. Risco: dados legados duplicados quebram a criação do índice; a migration verifica e falha com relatório em vez de apagar nada.

### D3. Unicidade de unidade
Índice único parcial `(property_id, lower(label)) WHERE is_active`. Erro mapeado para 409 `DUPLICATE_UNIT_LABEL`.

### D4. Erros de domínio
`apierr.ErrConflict` (novo, se não existir) para duplicidade, tratado no handler com 409 e código SNAKE_CASE (`DUPLICATE_DOCUMENT`). Verificação com `errors.Is`.

### D5. Frontend: uma árvore de rotas
Mantém `/properties/**` e `/tenants/**`. As telas de `/owner/properties` e `/owner/tenants` só são removidas depois de comparar funcionalidade: o que existir só nelas é portado antes. `next.config.ts` redireciona as rotas antigas (permanente). Os `*-dal.ts` de `owner/` e as actions duplicadas colapsam em um único cliente por domínio. Componentes só de shadcn/ui.

### D6. Formulários
react-hook-form + Zod em `src/lib/schemas.ts`, espelhando as regras do backend (CPF/CNPJ, CEP, UF). Máscaras de CPF/CNPJ/CEP/telefone no campo, enviando dígitos.

## Risks / Trade-offs

- [Duplicidade legada impede criar o índice] → Migration faz verificação prévia e aborta com lista; correção manual antes de aplicar.
- [Remover `/owner/*` quebra favoritos] → Redirects permanentes.
- [Algo existir só em `/owner/*`] → Tarefa de comparação antes da remoção.
- [Validação de CPF/CNPJ rejeita dados de teste] → Fixtures de teste usam números válidos.
- [`pkg/document` confunde com `internal/document`] → Nomear `pkg/brdoc`.

## Migration Plan

1. `000036_add_property_unit_fields` e `000037_add_tenant_address` (up/down), mais os índices únicos com verificação prévia.
2. Backend com testes; deploy compatível (campos opcionais).
3. Frontend com redirects.
4. Rollback: down das migrations; as colunas são aditivas.

## Open Questions

- Existe funcionalidade só nas telas `/owner/*`? Resolver na tarefa de comparação.
- Inquilino estrangeiro (sem CPF)? Proposta: fora do MVP.
