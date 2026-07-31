# Tool 06 — React performance playbook

Triage **top-down by impact**. Do not hunt `useMemo` before waterfalls and bundles.

Install full Vercel rule set when useful:
`npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices`

## P1 CRITICAL — Waterfalls

- `Promise.all` for independent work
- Start promises early; await at use site
- Actions/Handlers: fire unrelated I/O at top
- Own Suspense per slow independent subtree
- Cheap sync check before expensive async (`flag && await heavy()`)

→ details in [04-caching.md](04-caching.md)

## P1 CRITICAL — Bundle size

- Avoid barrel imports that pull unused modules
- `next/dynamic` for heavy/conditional client UI
- Statically analyzable paths only
- Minimize `'use client'`

## P2 HIGH — Server

- `React.cache` / `fetch` memoization
- Minimize props serialized Server→Client (pass what client needs, not whole rows)
- Auth inside every Server Action (security = also abuse/perf)

## P2–3 — Client data

Prefer SWR/TanStack Query; design for cross-component dedupe.

## P3 MEDIUM — Re-renders (don't over-invest)

- Subscribe to derived booleans, not raw high-churn values
- Derive in render; don't `useEffect` + extra state for pure derivations
- Functional `setState`; lazy `useState(() => init)`
- Don't memo trivial primitives
- Split effects with independent deps
- Interaction logic in event handlers, not effects
- `startTransition` / `useDeferredValue` for non-urgent updates
- Refs for values that shouldn't re-render
- Never define components inside render bodies

## P3 — Rendering

Utility CSS (Tailwind) = zero runtime style cost; pairs with RSC. Stable wrappers around animated SVGs.

## P4 LOW — Micro-opts

Batch DOM read/write; `Set`/`Map` for membership; cache hot pure computations. Only on proven hot paths.

## PR / incident checklist

```
- [ ] Independent awaits parallelized?
- [ ] Unnecessary client JS / barrels / dynamic candidates?
- [ ] Over-serialized Server→Client props?
- [ ] Action auth present?
- [ ] Only then: re-render / memo review
```
