# `frontend/src/app/globals.css` — patch

The repo's `globals.css` already defines the **core** InquilinoTop tokens (`--primary`, `--surface`, `--on-surface`, `--chart-1..5`, etc.). The redesign references a few additional tokens that aren't there yet. Add them to **both** `:root,[data-theme="light"]` and `.dark,[data-theme="dark"]`.

Drop this block at the end of the light-theme `:root` block (just before the `}` that closes it) and adapt for dark below.

```css
/* InquilinoTop Design System — extended tokens */
:root,
[data-theme="light"] {
  /* ... existing tokens ... */

  /* Semantic — success */
  --color-success-50:  #ecfdf3;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-700: #15803d;

  /* Semantic — warning */
  --color-warning-50:  #fffaeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;

  /* WhatsApp brand (used for the "Cobrar via WhatsApp" pill) */
  --color-whatsapp: #25d366;
}

.dark,
[data-theme="dark"] {
  /* ... existing tokens ... */

  --color-success-50:  #052e16;
  --color-success-500: #22c55e;
  --color-success-600: #4ade80;
  --color-success-700: #86efac;

  --color-warning-50:  #2a1c00;
  --color-warning-500: #fbbf24;
  --color-warning-600: #fcd34d;
  --color-warning-700: #fde68a;

  --color-whatsapp: #25d366;
}
```

Then expose them as Tailwind utility colors inside the existing `@theme inline` block:

```css
@theme inline {
  /* ... existing aliases ... */

  --color-success: var(--color-success-600);
  --color-warning: var(--color-warning-600);
  --color-whatsapp: var(--color-whatsapp);
}
```

After this you can use `text-[color:var(--color-success-600)]`, `bg-[color:var(--color-whatsapp)]/12`, etc. — which is what the target components do.

## Brand-name correction (separate but related)

`frontend/src/components/Sidebar.tsx` still renders `PropHero` in the brand block. The canonical name is **InquilinoTop**. Change:

```tsx
<h1 className="text-2xl font-bold text-sidebar-primary tracking-tight">PropHero</h1>
<p className="text-sm text-sidebar-foreground/70">Gestão Imobiliária</p>
```

to:

```tsx
<h1 className="text-xl font-bold text-sidebar-primary tracking-tight">InquilinoTop</h1>
<p className="text-xs text-sidebar-foreground/70">Gestão imobiliária</p>
```

(Note the case change on the subtitle — the design system uses sentence case.)
