## Context

**Current State:**
- Frontend Next.js 16 com shadcn/ui (Radix primitives + Tailwind CSS)
- ~60 arquivos em `src/components/ui/*`, `src/app/*`, `src/data/*`
- Design tokens manuais em Tailwind configurado manualmente
- UI Components: button, input, card, badge, table, dialog, etc.

**Target:**
- Substituir shadcn/ui por @heroui/react mantendo toda lógica

**Constraints:**
- Manter server actions, DAL, Supabase bindings intactos
- Manter rotas existentes (`/`, `/login`, `/properties`, `/tenants`, `/units`)
- Usar cores/spacing do DESIGN.md (`docs/frontend/inquilinotop_core/DESIGN.md`)
- HeroUI tem seu próprio theme — mapear os tokens do DESIGN.md

## Goals / Non-Goals

**Goals:**
1. Instalar @heroui/react e configurar theme com tokens do DESIGN.md
2. Criar 6 telas matching os HTML em `docs/frontend/*`
3. Substituir componentes UI shadcn por HeroUI mantendo lógica
4. Garantir funcionalidad intacta (CRUD properties, tenants, units, payments)

**Non-Goals:**
- Não migrar autenticação (identity/auth continua Supabase)
- Não alterar server actions ou DAL
- Não modificar estrutura de rotas

## Decisions

### D1: HeroUI Theme Configuration

**Decision:** Configurar HeroUI Provider com tokens customizados do DESIGN.md

**Rationale:** HeroUI usa seu próprio sistema de theming. Vamos mapear:
```typescript
// heroui-theme.ts
const theme = {
  colors: {
    primary: { ...DEFAULT },
    secondary: '#FF8B00', // secondary-container
    // ... mapear todos os tokens do DESIGN.md
  },
  // fonts, spacing, borderRadius conforme DESIGN.md
}
```

**Alternatives considered:**
- Manter Tailwind e usar HeroUI como referência visual apenas → Rejeitado: usuário quer instalar @heroui/react

### D2: Component Mapping (shadcn → HeroUI)

| shadcn | HeroUI | Notas |
|--------|--------|-------|
| Button | Button | props similares |
| Input | Input | wrapper com Label |
| Card | Card | - |
| Badge | Badge | - |
| Table | Table | - |
| Dialog | Modal | slightly different API |
| Select | Select | - |
| DropdownMenu | Dropdown |

**Alternatives considered:**
- Criar wrappers shadcn-like sobre HeroUI → Mantém código existente mas agrega complexidade
- Substituir diretamente → mais simples, código novo

### D3: Estrutura de Arquivos

```
frontend/src/
├── app/heroui-provider.tsx    # HeroUI Provider + theme
├── components/ui/             # KEEP - mas reimplementar com HeroUI
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   └── ...
└── app/
    ├── login/page.tsx          # Reescrever com HeroUI
    ├── page.tsx                # Dashboard
    └── ...
```

**Rationale:** Manter em `components/ui/` permite migrations incrementais.

### D4: Implementação Incremental vs Big Bang

**Decision:** Implementar tela por tela - não big bang

**Rationale:**
- Risco menor de quebrar tudo
- Usuário pode validar progresso
- 6 telas independentes podem ser feitas em paralelo eventual

## Risks / Trade-offs

**R1: Breaking Changes em APIs de Componentes**
- → Mitigation: Testar cada tela com `npm run dev` antes de prosseguir

**R2: Tema HeroUI não cobre todos os casos shadcn**
- → Mitigation: Criar componentes wrapper quando necessário

**R3: Conflito de dependência (React 19 vs HeroUI)**
- → Mitigation: Verificar compatibilidade @heroui/react com React 19 antes de instalar

## Migration Plan

1. **Setup:** Instalar `@heroui/react`, criar `heroui-provider.tsx`
2. **Theme:** Mapear DESIGN.md tokens para HeroUI theme
3. **Screens:** Implementar 6 telas em ordem:
   - Login → Dashboard → Properties → Property Details → Tenants → Unit Details
4. **Test:** Verificar cada rota manualmente
5. **Deploy:** Push e verificar produção

**Rollback:** Git revert - manter código antigo em branch se necessário.