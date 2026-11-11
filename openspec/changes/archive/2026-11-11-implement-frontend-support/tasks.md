## 1. Setup and Routing

- [x] 1.1 Create the `/support` route namespace in `frontend/src/app`
- [x] 1.2 Implement the Support layout with navigation elements (Central, Novo Chamado, Contatos). `frontend/src/app/support/layout.tsx`: nav com Central, Novo Chamado e Contatos acima das páginas de `/support`.
- [x] 1.3 Add route links in navigation

## 2. Support Central Dashboard

- [x] 2.1 Implement the Support Central page `support/page.tsx`
- [x] 2.2 Add the search bar component
- [x] 2.3 Implement 4 category cards (Financeiro, Contratos, App, Outros)
- [x] 2.4 Add hover effects to cards

## 3. Open New Ticket

- [x] 3.1 Implement `/support/new-ticket/page.tsx`
- [x] 3.2 Create the ticket form with type, subject, description
- [x] 3.3 Add form validation
- [x] 3.4 Implement success state on submit. `new-ticket/page.tsx`: `toast.success('Chamado enviado com sucesso')` antes do redirect para `/support/tickets` (Toaster no root layout persiste na navegação). Teste temporário (removido) com 2 casos PASS: sucesso → toast + push; erro da API → sem toast, sem push.

## 4. Contacts

- [x] 4.1 Implement `/support/contacts/page.tsx`
- [x] 4.2 Display 4 contact cards (WhatsApp, Email, Phone, Hours)