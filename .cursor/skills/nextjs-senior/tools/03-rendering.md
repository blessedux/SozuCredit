# Tool 03 — Rendering strategies

RSC ≠ SSR. **RSC** = where code executes (Server Components ship zero client JS). **SSR** = when HTML is generated (per request).

## Decision table

| Scenario | Strategy |
|---|---|
| Marketing/docs, same for everyone | SSG (static shell) |
| Catalog/blog; known update events | Cached + on-demand `revalidateTag`/`updateTag` (prefer over tiny TTL) |
| Must reflect this exact request | Dynamic (Suspense hole) |
| Static chrome + personalized holes | **PPR / Cache Components** |
| Realtime / client-only auth / heavy widget | Small CSR island |
| No auth / browser API / interactivity | Server Component (default) |

## Cache Components model (default for mixed pages)

`cacheComponents: true` in `next.config.ts` (replaces `experimental.ppr`).

One route, three content types:
1. **Static** — sync/pure → prerendered at build
2. **Cached** — `'use cache'` + `cacheLife` / `cacheTag`
3. **Dynamic** — cookies/headers/uncached search → `<Suspense>` stream

```tsx
export default function Page() {
  return (
    <>
      <header><h1>Dashboard</h1></header> {/* static */}
      <Stats />                             {/* cached */}
      <Suspense fallback={<Skeleton />}>
        <Notifications />                   {/* dynamic */}
      </Suspense>
    </>
  )
}

async function Stats() {
  'use cache'
  cacheLife('hours')
  cacheTag('dashboard-stats')
  return <StatsDisplay stats={await db.stats.aggregate()} />
}

async function Notifications() {
  const userId = (await cookies()).get('userId')?.value
  return <List items={await db.notifications.findMany({ where: { userId } })} />
}
```

## Classic modes (still useful vocabulary)

**SSG** — build-time, CDN. Failure mode: personalized/fast-changing without invalidation path.

**ISR** — static + regen. Prefer event-driven invalidation over polling short TTLs. Vercel: durable + global fan-out; self-host: often single-region/ephemeral.

**SSR** — every request when reading uncached request APIs. Cost: round-trip; Suspense or wait on slowest dep.

**CSR** — exception. Smell: `useEffect`+`fetch` for data a Server Component could prepare.

## Constraints

- Cache Components: Node only; no static export
- Non-deterministic values inside `'use cache'` freeze at cache time — use `connection()` outside cache for per-request entropy

Deep cache API detail → [04-caching.md](04-caching.md).
