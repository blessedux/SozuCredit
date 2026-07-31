---
name: nextjs-senior
description: >-
  Senior Next.js toolkit in one skill: architecture loop, App Router/RSC
  boundaries, Cache Components (PPR, use cache, cacheLife, cacheTag,
  updateTag), data patterns, performance, TypeScript, Tailwind v4, and
  scale. Use when building or reviewing Next.js/React apps, choosing
  rendering/caching, Server Actions, RSC boundaries, or perf triage.
  Self-contained — do not fall back to next-best-practices or
  next-cache-components.
---

# nextjs-senior

Fast, cheap, maintainable. Self-contained: load tools below as needed; do **not** open `next-best-practices` or `next-cache-components`.

## Always-on

1. Five questions before SSG/ISR/SSR/PPR/CSR (tool 01).
2. Server Components default; `'use client'` only for state/effects/browser/handlers.
3. Auth inside every Server Action — middleware/layout is not enough.
4. Parallelize independent I/O; Suspense-split slow subtrees.
5. Cache Components: dynamic default; `'use cache'` + tags; revalidate on write.
6. Minimize client bundle + Server→Client serialized props.
7. Zod at boundaries; `strict` TS; semantic tokens/CVA for UI systems.
8. Docs win over memory ([tools/11-sources.md](tools/11-sources.md)).

## Senior loop

```
- [ ] Frame     → 01
- [ ] Render    → 03 (+ essentials below)
- [ ] Structure → 02
- [ ] Data      → 04
- [ ] Implement → 07 / 08 / 10 as needed
- [ ] Perf gate → 06 (waterfalls → bundle → server → re-renders)
- [ ] Deploy    → 05 if shipping
```

Before coding, state: five answers · render strategy · cache/invalidation · what earns `'use client'`.

---

## Essentials (from App Router + Cache Components)

### Directives
| Directive | Role |
|---|---|
| `'use client'` | Hooks, handlers, browser APIs — boundary for whole module graph below |
| `'use server'` | Server Action (file or inline); callable from client; **public HTTP** |
| `'use cache'` | Needs `cacheComponents: true`; file/component/function scope |

Node runtime by default. Edge only for proven geo/latency need. Cache Components **require Node** (no edge, no static export).

### RSC boundaries (hard rules)
- No `async` Client Components — fetch in Server parent, pass props.
- Server→Client props must be JSON-serializable (no bare functions/Dates/Maps/class instances). Serialize dates to ISO; plain objects only.
- Exception: `'use server'` functions may be passed to client.
- Pass Server trees as `children` into Client wrappers — don't import Server into Client files.

### Async request APIs (Next 15+)
`params`, `searchParams`, `cookies()`, `headers()` are `Promise`s — always `await` (or `React.use()` in sync components). Enables static shell + PPR.

### Data pattern pick
| Need | Use |
|---|---|
| Internal read | Server Component fetch (no API layer) |
| UI mutation | Server Action + auth + revalidate |
| External/webhook/REST/mobile | Route Handler |
| Client interaction/realtime | SWR/TanStack (or pass initial from server) |

`route.ts` and `page.tsx` cannot share a folder. Never wrap `redirect`/`notFound` in try/catch without `unstable_rethrow` — they throw for control flow.

### Cache Components (PPR)
Enable: `cacheComponents: true` (replaces `experimental.ppr`).

Three content types on one route:
1. **Static** — sync/pure → prerendered shell
2. **Cached** — `'use cache'` + `cacheLife` / `cacheTag`
3. **Dynamic** — runtime (`cookies`/`headers`/uncached search) → wrap in `<Suspense>`

```ts
'use cache'                 // default profile
'use cache: remote'         // platform remote cache
'use cache: private'        // allows runtime APIs (compliance escape)
```

| API | When |
|---|---|
| `cacheLife('hours' \| { stale, revalidate, expire })` | Freshness profile |
| `cacheTag('x', 'y')` | Name for invalidation |
| `revalidateTag('x')` | Background SWR — next request fresh |
| `updateTag('x')` | Immediate — same request sees fresh |

**Inside `'use cache'`:** cannot call `cookies()`/`headers()`/`searchParams`. Extract outside, pass as args (args/closures become cache key). Prefer that over `use cache: private`.

Cache key auto: build ID + function ID + serializable args + closures. Deploy invalidates all. `Math.random()`/`Date.now()` inside cache run once at cache time — use `connection()` from `next/server` for per-request entropy outside cache.

Migration: `force-dynamic` → remove (default) · `force-static` → `'use cache'` + `cacheLife('max')` · `revalidate = N` → `cacheLife({ revalidate: N })` · `unstable_cache` → `'use cache'`.

### Platform gotchas
- `useSearchParams()` (and `usePathname` on dynamic routes) need `<Suspense>` or the route CSR-bailouts.
- Prefer `next/image` + `next/font`; configure `images.remotePatterns`.
- Browser-only packages: `next/dynamic(..., { ssr: false })` or Client wrapper; native/problematic server pkgs → `serverExternalPackages`.
- Hydration: no `window`/locale dates/random IDs in SSR markup without client-only mount.
- Next 16: `middleware.ts` → `proxy.ts` when on that version (same edge role: auth/geo/A/B — never DB).

---

## Tools (load on demand)

| Tool | When |
|---|---|
| [01-architecture](tools/01-architecture.md) | Where code runs; five questions |
| [02-app-router](tools/02-app-router.md) | Routes, RSC rules, Actions, errors, Suspense hooks |
| [03-rendering](tools/03-rendering.md) | SSG/ISR/SSR/PPR/CSR decision |
| [04-caching](tools/04-caching.md) | Waterfalls, `use cache`, tags, invalidation |
| [05-edge-deploy](tools/05-edge-deploy.md) | CDN lifecycle, self-host |
| [06-performance](tools/06-performance.md) | Perf triage P1→P4 |
| [07-typescript](tools/07-typescript.md) | Types, Zod |
| [08-design-system](tools/08-design-system.md) | Tailwind v4, CVA |
| [09-agent-repo](tools/09-agent-repo.md) | AGENTS.md |
| [10-scale](tools/10-scale.md) | Composition, tenant cache keys |
| [11-sources](tools/11-sources.md) | Official docs |
