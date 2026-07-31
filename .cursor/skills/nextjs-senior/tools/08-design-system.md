# Tool 08 — Tailwind v4 design systems

v4 = CSS-first tokens via `@theme` (not `tailwind.config.js` as source of truth). Oxide = fast rebuilds. Tokens become runtime CSS variables.

## Token layers

```css
@import "tailwindcss";

@theme {
  /* primitive */
  --color-slate-900: #0f172a;
  --color-blue-600: #2563eb;

  /* semantic — what components reference */
  --color-text-primary: var(--color-slate-900);
  --color-action-primary: var(--color-blue-600);

  /* component */
  --color-button-primary-bg: var(--color-action-primary);
}
```

Rebrand / dark mode updates the semantic layer; components keep using purpose names.

## Dark mode gotcha

`@theme inline` bakes values at build time → breaks runtime theme toggle.

Correct pattern:
1. Raw channels on `:root` / `.dark` as plain custom properties
2. Map into `@theme` **without** `inline` so utilities re-resolve on class toggle

## Variants: CVA

```ts
const button = cva('rounded-md font-medium transition-colors', {
  variants: {
    intent: {
      primary: 'bg-action-primary text-white hover:opacity-90',
      secondary: 'bg-transparent border text-text-primary',
    },
    size: { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-base' },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
})
```

Own copy-in components (shadcn-style) over opaque third-party internals when you need control.

## Hygiene

- Repeated `text-[15px]` → promote to `@theme` token
- `@apply` sparingly (bridge third-party internals, not everyday styling)
- 12+ classes on one node → extract component/CVA
- Bake a11y into base: `focus-visible`, `prefers-reduced-motion`, contrast/forced-colors
- Old-browser hard requirement → stay on v3.4 deliberately

## When not Tailwind

- Hard style isolation across independently deployed microfrontends → CSS Modules / scoped CSS-in-JS
- Complex multi-stage keyframe choreography → plain CSS or Motion
