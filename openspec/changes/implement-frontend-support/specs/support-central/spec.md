# Suporte Central Specification

## Overview

The Support Central is the main help dashboard where users can browse help categories, search knowledge base articles, and navigate to support actions.

## UI/UX

### Layout
- Full-width header with page title "Central de Suporte" and search bar
- Category cards grid below (2 columns on mobile, 4 on desktop)
- "Recent Articles" list below categories

### Components
- **Search Bar**: Large input with search icon, placeholder "Buscar artigos..."
- **Category Card**: Icon + title, hover state with subtle lift (shadow)
- **Category Options**:
  - Financeiro (Wallet icon)
  - Contratos (FileText icon)
  - App (Smartphone icon)
  - Outros (MoreHorizontal icon)

### Visual Design
- Background: white/gray-50
- Card background: white with subtle shadow
- Colors: use primary brand color for accents
- Typography: Inter, headings semibold

## Functionality
- Search filters articles in real-time (mocked)
- Clicking a category navigates to filtered view (future)

## Acceptance Criteria
- [ ] Header displays "Central de Suporte" title
- [ ] Search bar is visible and styled
- [ ] 4 category cards display with icons
- [ ] Cards have hover effects