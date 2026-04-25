# Prompt para Google Stitch / v0 (Protótipo do Módulo Financeiro)

Cópia deste prompt pode ser colada diretamente em ferramentas de geração de UI como Google Stitch, v0.dev ou Claude Artifacts para gerar o protótipo funcional de alta fidelidade do módulo financeiro.

```text
Create a comprehensive prototype for the "Módulo Financeiro" (Financial Module) of "InquilinoTop", a property management application tailored for Brazilian real estate agencies and landlords. 
All text must be in Brazilian Portuguese and currency in BRL (R$).

## Global Layout & Navigation
- Left Sidebar Navigation: 
  - Logo "InquilinoTop"
  - Menu Items: Dashboard Financeiro, Contas a Receber, Contas a Pagar, Conciliação Bancária, Repasses, Comissões, Relatórios.
- Top Header: Global Search, Notification bell (with a red dot), User Avatar (Gestor Financeiro).
- Main Content Area: Light gray background (#f5f5f5) with white, rounded cards (0.5rem radius, subtle shadow).
- Font: Geist Sans or Inter.

## Pages to Implement

**1. Dashboard Financeiro (/financeiro/dashboard)**
- Header: "Visão Geral - Mês Atual" with a Date Picker to change months.
- 4 Key Metric Cards (KPIs):
  - Receita Prevista vs. Realizada (progress bar)
  - Índice de Inadimplência (e.g., 4.2% - Red/Green indicator)
  - Valor Geral de Aluguel (VGA)
  - Total a Repassar (Proprietários)
- Main Chart (Area/Bar): "Fluxo de Caixa" showing Receitas vs Despesas over the last 6 months.
- Side Panel: "Aging de Contas (Inadimplência)" listing top 3 late tenants with "Cobrar via WhatsApp" buttons.

**2. Contas a Receber - Cobranças (/financeiro/receber)**
- Tabs: Aluguéis, Parcelas de Venda, Taxas Condominiais.
- Toolbar: Search input, Filter by Status (Pago, Pendente, Atrasado), "Nova Cobrança" button.
- Table: 
  - Columns: Vencimento, Pagador (Locatário), Imóvel/Contrato, Valor, Forma de Pagto (Boleto/PIX), Status, Ações.
  - Status Badges: Pago (Green #22c55e), Pendente (Yellow/Gray), Atrasado (Red #ef4444).
  - Row Actions (dropdown): "Ver Detalhes", "Enviar Lembrete", "Baixa Manual", "Gerar 2ª Via".

**3. Contas a Pagar (/financeiro/pagar)**
- Toolbar: Search, Filter by Category, "Nova Despesa" button.
- Table:
  - Columns: Vencimento, Fornecedor/Imposto, Categoria (IPTU, Condomínio, Manutenção, DARF), Valor, Imóvel Vinculado, Status.
  - Checkboxes on the left to allow batch actions like "Pagar Selecionados".

**4. Conciliação Bancária (/financeiro/conciliacao)**
- Header: "Conciliação de Extrato (OFX/CNAB)" with an "Importar Arquivo" button.
- Split View Layout:
  - Left Side (Extrato do Banco): List of bank statement lines (Data, Descrição, Valor).
  - Right Side (Sistema): Matching system records (Boletos/Pagamentos).
- Matching UI:
  - Green link icon for exact matches (Value and Date match perfectly).
  - Yellow warning for partial matches (suggestions).
  - Actions per row: "Confirmar Conciliação" (gives visual feedback and fades out the row).

**5. Repasses a Proprietários (/financeiro/repasses)**
- Description: "Gerenciamento de pagamentos líquidos aos proprietários dos imóveis".
- Table: 
  - Columns: Proprietário, Imóveis, Recebimento Bruto, Taxa ADM (%), Descontos (IPTU/IRRF), Valor Líquido, Status do Repasse.
  - Row Action: "Ver Extrato".
- Top Button: "Processar Repasses do Mês".

**6. Comissões de Vendas e Locação (/financeiro/comissoes)**
- Table: Corretor, Tipo (Venda/Locação), Valor Base, % Comissão, Retenção ISS/IRRF, Valor a Pagar.
- Allows visualizing the split of commissions between multiple brokers.

## Interactive Dialogs / Modals (Implement at least 2)

**Modal 1: Detalhes do Repasse (Extrato)**
- Triggered by clicking "Ver Extrato" in the Repasses table.
- Shows a breakdown:
  - (+) Valor do Aluguel Recebido: R$ 3.000,00
  - (-) Taxa de Administração (10%): R$ 300,00
  - (-) Retenção IRRF (Carnê-leão): R$ 45,00
  - (-) Pagamento IPTU retido: R$ 150,00
  - (=) Total a Repassar: R$ 2.505,00
- Button: "Aprovar e Gerar Transferência".

**Modal 2: Gerar Nova Cobrança**
- Form fields: Selecionar Contrato (dropdown), Data de Vencimento, Valor (R$), Multa por atraso (%), Adicionar Despesa Extraordinária (link to add rows).
- Preview showing how the Boleto and PIX QR Code will look.

## Design System & Styling Rules
- Use Lucide React for modern icons.
- Colors: Primary brand color Dark Gray (#2a2a2a). Accent colors strictly semantic (Green for success/money in, Red for danger/money out).
- Forms: Show clean inputs with labels, focus rings, and placeholder text.
- Interactions: Hover states on table rows, smooth transitions on tabs, badges with subtle background opacity (e.g., bg-green-100 text-green-700).
- State: Mock enough data (at least 5-6 rows per table) so the prototype feels alive and realistic.
```
