Create a property management web application prototype called "InquilinoTop" for Brazilian landlords. All text in Brazilian Portuguese. Currency: Brazilian Real (R$).

## Pages

**Login Page**
- Email/password form centered on gray background
- Toggle between "Entrar" (login) and "Cadastrar" (signup)
- Error/success messages, card-based centered layout

**Dashboard**
- 4 stat cards: Total Imoveis, Inquilinos ativos, Unidades ocupadas, Taxa de vacancia
- Financial summary bar: Receita mensal (prevista, recebida, pendente, atrasada) with progress bar
- Recent activity section: last payments + expiring contracts alerts
- Welcome message: "Visao geral dos seus imoveis e financas deste mes"

**Properties List (/properties)**
- Search bar with real-time filter
- Grid of property cards: name, type badge (Residencial/Unico), address, city/UF, unit count
- "Novo Imovel" button (top right)
- Click card navigates to property details

**New/Edit Property (/properties/new, /properties/[id]/edit)**
- Form fields: Nome do imovel (required), Tipo (select: Unico/Casa/Loja or Residencial/Predio), Endereco, Cidade, Estado (UF, 2 chars)
- Validation with inline errors
- Submit button

**Property Details (/properties/[id])**
- Header: property name, type badge, full address
- Edit (pencil) and Delete buttons
- Units table: Identificacao, Andar, Status (Ativo/Inativo badges), Actions dropdown
- "Adicionar Unidade" button opens dialog
- "Voltar" arrow button

**Tenants List (/tenants)**
- Table: Nome, Email, Telefone, CPF/CNPJ, Status (Ativo/Inativo badges), Actions
- "Novo Inquilino" button opens form dialog
- Edit, toggle active/inactive, delete actions

**Unit Details (/units/[id])**
Two states based on active lease:
1. ACTIVE LEASE: ActiveLeaseCard + Payment list + Expenses
2. VACANT: "Esta unidade esta vazia" message + "Novo Contrato" button

**Active Lease Card**
- Tenant info: name, email, phone
- Lease period: start_date to end_date
- Payment day: 1-31
- Monthly rent: R$ amount
- Notes section
- Two buttons: "Cancelar Contrato (Erro)" and "Encerrar Contrato (Desocupacao)"

**Payment List**
- Table: Vencimento, Descricao, Valor, Status, Actions
- Status badges: Pago (green #22c55e), Pendente (gray), Atrasado (red #ef4444)
- "Nova Despesa" button
- Action: mark as Paid / reopen as Pending
- Date format: DD/MM/YYYY

**Expense List**
- Same table structure as payments
- Category selector: Energia, Agua, Condominio, IPTU, Manutencao, Outro
- New expense form dialog

## Create Lease Dialog
- Select tenant (dropdown)
- Start/end dates (date picker)
- Monthly rent amount (R$)
- Payment day (1-31 dropdown)
- Notes (optional textarea)

## Create Tenant Dialog
- Name, email, phone, document (CPF/CNPJ)

## Design System
- Font: Geist Sans
- Background: #f5f5f5 (light gray)
- Cards: white, rounded (0.625rem), subtle shadow, border
- Primary: #2a2a2a (dark gray)
- Success/Paid: #22c55e (green)
- Warning/Pending: #eab308 (yellow)
- Error/Late/Destructive: #ef4444 (red)
- Secondary: #f5f5f5
- Icons: Lucide React
- Toast notifications (Sonner style)

## Layout
- Header: "Inquilino Top" logo left, nav center (Imoveis, Inquilinos), logout right
- Container: centered, max-width, py-8 padding
- Responsive: 1 col mobile -> 2 cols tablet -> 3-4 cols desktop
- Footer: copyright text

## Interactions
- Dialog: fade-in animation
- Buttons: hover states, loading spinner on submit
- Tables: hover row highlight, dropdown actions
- Forms: shake animation on validation error, green check on success
- Badges: subtle background with colored text
- Empty states: illustration placeholder + action button
- Confirmation dialog for delete actions