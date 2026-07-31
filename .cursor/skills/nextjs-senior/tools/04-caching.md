# Tool 04 — Caching, data fetching & Cache Components APIs

CRITICAL: kill waterfalls and shrink bundles before re-render tuning.

## Kill waterfalls

```tsx
const [user, posts] = await Promise.all([getUser(), getPosts()])
```

Start independent promises early; await late. In Actions/Handlers, fire unrelated I/O at the top. Own Suspense per slow independent subtree. Preload pattern: `void getUser(id)` via `React.cache`-wrapped loader, then await later.

Cheap sync check before expensive async (`flag && await heavy()`).

## Per-request dedupe

- Identical `fetch(url, opts)` → auto-dedupe in one render
- ORM/DB → `React.cache` (request-scoped only)

## Enable Cache Components

```ts
// next.config.ts
const nextConfig = { cacheComponents: true }
export default nextConfig
```

## `'use cache'` scopes

File / component / function. Variants:
- `'use cache'` — default profile (~stale/revalidate defaults)
- `'use cache: remote'` — platform remote cache
- `'use cache: private'` — allows runtime APIs (prefer refactor over this)

### `cacheLife`

```tsx
cacheLife('hours') // default | minutes | hours | days | weeks | max
cacheLife({ stale: 3600, revalidate: 7200, expire: 86400 })
```

### `cacheTag` + invalidation

```tsx
cacheTag('products', `product-${id}`)

// After mutation:
revalidateTag('products')  // background SWR — next request fresh
updateTag(`product-${id}`) // immediate — same request sees fresh
```

Couple invalidation to the write inside the Action (after auth + successful mutate).

### Runtime data constraint

**Cannot** use `cookies()` / `headers()` / `searchParams` inside `'use cache'`.

```tsx
// Correct: extract outside, pass in (becomes cache key)
async function Page() {
  const session = (await cookies()).get('session')?.value
  return <CachedProfile sessionId={session} />
}
async function CachedProfile({ sessionId }: { sessionId: string }) {
  'use cache'
  cacheTag(`profile-${sessionId}`)
  return <div>{(await fetchUser(sessionId)).name}</div>
}
```

### Cache key (automatic)

Build ID · function ID · serializable args · closure values. Deploy invalidates everything. Include **tenant ID / flag** in args or tags for multi-tenant/flagged output (see tool 10).

`Math.random()` / `Date.now()` inside cache execute once at cache fill — for per-request values, `await connection()` outside cache.

## Mutations checklist

1. Auth inside Action  
2. Mutate  
3. `updateTag` (same-request freshness) and/or `revalidateTag` (SWR)  
4. Never rely on layout/middleware auth alone  

## Client fetching — when OK

Interaction-driven, realtime, deliberate client-only auth. Prefer SWR/TanStack. Prefer passing initial data from Server Component when possible.

## Bundle hygiene

No fat barrels · `next/dynamic` for heavy/conditional client · statically analyzable imports · minimize `'use client'` · minimize Server→Client prop payload.

## Migration map

| Old | New |
|---|---|
| `experimental.ppr` | `cacheComponents: true` |
| `dynamic = 'force-dynamic'` | Remove (default) |
| `dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| `revalidate = N` | `cacheLife({ revalidate: N })` |
| `unstable_cache()` | `'use cache'` |

## Data checklist

1. Server-capable? → server  
2. Independent async? → parallelize / Suspense  
3. Shared on page? → `fetch` dedupe / `React.cache`  
4. Knowable write event? → tag + `revalidateTag`/`updateTag`  
5. Constant churn, no event? → short `cacheLife` or dynamic  
6. Truly client-only? → client library  
