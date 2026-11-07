## Why

Inquilinos é a segunda tela da Onda 1 do redesign, que usa o canvas "ImoviFlow — Telas" como fonte da verdade. Hoje a lista é uma tabela simples com criação, edição e exclusão em `Dialog`, e o detalhe mostra o histórico de contratos. O canvas pede outra coisa: uma lista que responde "quem está em dia e quem está atrasado", cadastro rápido em painel lateral e um detalhe centrado no contrato atual e na cobrança do mês. Tudo isso se monta com dados que o backend já entrega, sem mudar o Go.

## What Changes

**Frontend (`/tenants`)**
- Lista em tabela (Inquilino, Documento, Imóvel e unidade, Cobrança do mês) com busca, filtro por situação de cobrança, botão **Importar** (para `/import`), estado vazio e de erro, e rodapé com a contagem. No celular, cards.
- Cadastro rápido em painel lateral (`?novo=1`): Tipo (Pessoa física/Empresa), Nome, CPF/CNPJ, E-mail, Celular (WhatsApp) e Observações. **Sai** do formulário o endereço (CEP, logradouro, cidade, UF); as colunas continuam no banco.
- Edição no mesmo painel, aberta pelo detalhe (`?editar=1`), com a exclusão no rodapé. A edição **preserva** o endereço já gravado: o backend sobrescreve com `NULL` o que o `PUT` omite, então o formulário repassa os valores antigos sem mostrá-los.
- Detalhe sem abas: cabeçalho com Editar, Abrir WhatsApp e, sem contrato, Criar contrato; cartões de Cobrança do mês, Contrato atual, Observações e Contato. Detalhe "Sem contrato" quando não há contrato ativo.
- Situação de cobrança por inquilino derivada no servidor Next: Pago, Atrasado, Previsto ou Sem contrato.
- CPF/CNPJ mascarado (`123.456.***-09`) na lista e no detalhe, aplicado **no servidor** antes de os dados chegarem a componentes cliente.
- **BREAKING** (tela): o detalhe deixa de listar todos os contratos do inquilino; o histórico passa a viver em Contratos.

**Fora de escopo (adiado):** Fiador (pertence ao contrato, entra na onda de Contratos), estado "Aguardando confirmação", faixa "Avisou que pagou" e botão "Confirmar pagamento" (dependem do fluxo 04), abas Extrato e Documentos, "Próx. reajuste" (não há campo no contrato), qualquer mudança de backend.

## Capabilities

### New Capabilities
- `tenant-overview`: derivação, para cada inquilino, do contrato atual, do imóvel e da unidade e da situação de cobrança do mês, a partir de inquilinos, contratos, imóveis e pagamentos.

### Modified Capabilities
- `tenant-registry`: telas de inquilinos (lista em tabela, cadastro rápido em painel lateral, edição que preserva o endereço, exclusão no painel, detalhe, máscara do documento, link do WhatsApp).

## Impact

- Frontend: `src/app/tenants/**`, `src/components/tenants/**` (substituindo `TenantListClient` e `TenantForm`), novos módulos em `src/lib/` (visão geral do inquilino, máscara parcial de documento, link do WhatsApp), `src/lib/schemas.ts` (sem mudar as regras), testes correspondentes.
- Backend e banco: **nenhuma mudança**. `GET /tenants`, `/leases`, `/properties` e `/payments` (com `from`, `to` e `status`) já existem.
- Dependências: nenhuma nova. Componentes novos de `ui/*` (se faltarem) devem vir do `shadcnds`.
- Risco de dados: o `PUT /tenants/{id}` apaga campos omitidos; o design trata isso com repasse dos valores antigos e teste dedicado.
