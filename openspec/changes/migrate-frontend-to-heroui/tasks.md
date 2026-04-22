## 1. Setup

- [x] 1.1 Install @heroui/react and framer-motion dependencies
- [x] 1.2 Create HeroUI provider with custom theme tokens from DESIGN.md
- [x] 1.3 Configure HeroUIProvider in app/layout.tsx
- [x] 1.4 Verify React 19 compatibility with HeroUI

## 2. UI Components

- [x] 2.1 Reimplement Button component using HeroUI Button (HeroUI v3 has native components)
- [x] 2.2 Reimplement Input component using HeroUI Input (use directly)
- [x] 2.3 Reimplement Card component using HeroUI Card (use directly)
- [x] 2.4 Reimplement Badge component using HeroUI Badge (use directly)
- [x] 2.5 Reimplement Table component using HeroUI Table (use directly)
- [x] 2.6 Reimplement Modal using HeroUI Modal (use directly)
- [x] 2.7 Reimplement Select component using HeroUI Select (use directly)
- [x] 2.8 Reimplement Dropdown using HeroUI Dropdown (use directly)

## 3. Login Screen

- [x] 3.1 Create HeroUI-based login page in /app/login/page.tsx
- [x] 3.2 Implement segmented tabs (Entrar/Cadastrar)
- [x] 3.3 Add email input with mail icon
- [x] 3.4 Add password input with visibility toggle
- [x] 3.5 Add "Acessar painel" submit button
- [x] 3.6 Add forgot password link

## 4. Dashboard Screen

- [x] 4.1 Create HeroUI-based dashboard in /app/page.tsx
- [x] 4.2 Implement stats cards bento grid (4 cards)
- [x] 4.3 Add trend indicators with icons
- [x] 4.4 Implement financial summary horizontal bar
- [x] 4.5 Add legend and value displays
- [x] 4.6 Implement recent activity list
- [x] 4.7 Add "Ver todo histórico" button

## 5. Properties Screen

- [x] 5.1 Create HeroUI-based properties page in /app/properties/page.tsx
- [x] 5.2 Implement property cards grid (responsive)
- [x] 5.3 Add type badges (Residencial/Comercial/Único)
- [x] 5.4 Implement search input with icon
- [x] 5.5 Add filter and sort buttons
- [x] 5.6 Add "Novo Imóvel" button

## 6. Property Details Screen

- [x] 6.1 Create HeroUI-based property details in /app/properties/[id]/page.tsx
- [x] 6.2 Implement header with name, badge, Edit/Delete buttons
- [x] 6.3 Add breadcrumb navigation
- [x] 6.4 Implement image/info split card
- [x] 6.5 Create occupation stats card with progress bar
- [x] 6.6 Implement units table with edit/delete actions
- [x] 6.7 Add "Adicionar Unidade" button
- [x] 6.8 Implement table pagination

## 7. Tenants Screen

- [x] 7.1 Create HeroUI-based tenants page in /app/tenants/page.tsx
- [x] 7.2 Implement tenants table with avatar column
- [x] 7.3 Add status badges (Ativo/Pendente/Inativo)
- [x] 7.4 Implement hover action buttons
- [x] 7.5 Add pagination controls
- [x] 7.6 Add "Novo Inquilino" button

## 8. Unit Details Screen

- [x] 8.1 Create HeroUI-based unit details in /app/units/[id]/page.tsx
- [x] 8.2 Implement header with status badge
- [x] 8.3 Add breadcrumb navigation
- [x] 8.4 Implement tenant card with avatar
- [x] 8.5 Create receipts table with status badges
- [x] 8.6 Implement contract summary card (primary color)
- [x] 8.7 Create quick actions buttons
- [x] 8.8 Add "Encerrar Contrato" button (error color)

## 9. Verification

- [x] 9.1 Test all routes manually (/, /login, /properties, /tenants, etc.)
- [x] 9.2 Verify responsive layouts work on mobile
- [x] 9.3 Check all interactive features (forms, modals)
- [x] 9.4 Run npm run build to verify no errors