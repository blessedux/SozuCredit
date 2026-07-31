# Tool 05 — CDN, edge & deployment

## Two-tier network (reference model)

- **PoPs** — first contact; cached static + true-edge Middleware
- **Regions** — ~compute regions; SSR/RSC/Actions/Handlers; co-locate DB here

Traffic: PoP → private backbone → region (not public internet for that hop).

## Request lifecycle

1. Nearest PoP
2. Routing rules (redirects/rewrites) — before cache
3. **Middleware** (pre-cache) — auth gate / geo / bots; never DB
4. Cache lookup — hit serves from PoP
5. Miss → region Function renders
6. Response may cache at PoP per headers

## Cache-Control layers

| Header | Controls |
|---|---|
| `Cache-Control` | Browser (+ often CDN) |
| `CDN-Cache-Control` | Edge CDN; browser ignores |
| `Vercel-CDN-Cache-Control` | Vercel edge only |

Common pattern: short/zero browser cache; longer edge + `stale-while-revalidate`.

## Invalidation is eventual

`revalidatePath` / `revalidateTag` fan out in ~1–3s+ under load. Pricing/inventory/auth-sensitive UI must tolerate eventual consistency or stay fully dynamic — do not assume global instant.

## Self-host tradeoffs (explicit decision)

You take on: single-region ISR by default, non-durable cache unless you build it, Draft Mode cookie security, image/font optimization pipeline, regional failover. Legitimate for compliance/lock-in/cost — document the choice.

## Team hygiene

- Preview deploy per PR (same edge behavior as prod)
- Env vars scoped: development / preview / production — never share prod secrets with previews
- Track field Core Web Vitals (LCP, INP, CLS), not only local Lighthouse
