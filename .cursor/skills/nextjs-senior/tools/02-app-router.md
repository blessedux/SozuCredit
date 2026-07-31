# Tool 02 — App Router, RSC & platform rules

## File conventions

| File | Role |
|---|---|
| `layout.tsx` | Shared UI; does **not** remount on sibling nav |
| `page.tsx` | Route UI; makes URL public |
| `loading.tsx` | Segment Suspense fallback |
| `error.tsx` | Error boundary — **must** be Client Component |
| `global-error.tsx` | Root layout errors — must include `<html>`/`<body>` |
| `not-found.tsx` | `notFound()` / missing route |
| `default.tsx` | Parallel route fallback |
| `route.ts` | Route Handler — **cannot** sit beside `page.tsx` in same folder |
| `template.tsx` | Like layout but remounts (rare) |

Folders: `(group)` · `[slug]` · `[...slug]` · `[[...slug]]` · `_private` · `@slot` parallel · intercept `(.)`/`(..)`/`(...)`.

Layouts = structural shell only — no page-wide fetching. Fetch near consumers; nested Suspense streams independently.

**Runtime:** Node default. `export const runtime = 'edge'` only with proven need + Edge-compatible deps. Cache Components require Node.

**Edge entry:** `middleware.ts` (≤15) / `proxy.ts` (16+) — auth gates, geo, A/B; never DB.

## RSC boundaries

| Pattern | Valid? | Fix |
|---|---|---|
| `'use client'` + `async function` | No | Fetch in Server parent, pass data |
| Pass `() => {}` to client | No | Define in client or pass Server Action |
| Pass `Date` / `Map` / `Set` / class | No | ISO string / plain object / array |
| Pass Server Action to client | Yes | — |
| Pass string/number/boolean/plain object | Yes | — |

Composition: Client wrapper receives Server UI as `children` from a Server parent — never import a Server Component into a Client file.

## Async request APIs

```tsx
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const { q } = await searchParams
}
// cookies()/headers() also await
// sync component: const { slug } = use(params)
```

Codemod if migrating: `npx @next/codemod@latest next-async-request-api .`

## Data: Component vs Action vs Route Handler

| Need | Use |
|---|---|
| Internal read | Server Component (direct DB/fetch) |
| UI mutation / form | Server Action |
| Webhooks, mobile, external REST, cacheable GET API | Route Handler |

### Server Actions

Public HTTP. Auth **inside** every action. Prefer for UI mutations (typed, progressive enhancement). POST-only; don't use for cacheable reads.

```ts
'use server'
export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')
  await db.post.create({ data: { /* … */ } })
  revalidateTag('posts')
}
```

Do **not** try/catch around `redirect`/`notFound` without rethrowing — they throw for navigation. Use `unstable_rethrow` or call them outside catch.

### Route Handlers

`GET`/`POST`/… in `route.ts`. Server-like env (async, cookies, Node) — no React hooks/DOM. Prefer `/api/...` when a page already owns the path.

## Metadata

Static `metadata` export or `generateMetadata` (await `params`). Prefer `next/og` for OG images when dynamic.

## Suspense + client navigation hooks

| Hook | Suspense |
|---|---|
| `useSearchParams()` | **Required** — else CSR bailout of the page |
| `usePathname()` | Required on dynamic routes (optional if `generateStaticParams`) |
| `useParams()` / `useRouter()` | No |

## Errors / auth helpers

- `error.tsx` + `reset()`; `global-error.tsx` for root
- `notFound()`, `redirect()`, `permanentRedirect()`
- `forbidden()` / `unauthorized()` for auth errors when using those APIs

## Images, fonts, bundling, hydration

- Prefer `next/image` (width/height or `fill`; `images.remotePatterns` for remote). `priority` for LCP.
- Prefer `next/font` (self-host subsets; works with Tailwind).
- Browser-only libs: `next/dynamic(..., { ssr: false })` or Client wrapper. Native/broken server pkgs → `serverExternalPackages`.
- Avoid fat barrels; prefer direct imports.
- Hydration mismatches: no `window`/locale `Date`/random IDs in SSR output — gate with client mount or render on client only.

## Colocation

One-route code → `_components` / `_lib`. Multi-route → shared `src/`. Underscore prevents accidental URLs.
