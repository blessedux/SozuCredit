# Tool 01 — Architecture mental model

## Four execution locations

| Location | What runs | Cost model |
|---|---|---|
| **Build time** | Static HTML/JSON/assets | Free per request; fresh only until redeploy/revalidate |
| **Edge / CDN (PoP)** | Cached output + Middleware | Near-user; Middleware runs *before* cache |
| **Server (per request)** | RSC, SSR, Actions, Route Handlers | Full compute latency; secrets/DB OK |
| **Browser** | `'use client'` + its JS | Bundle + hydrate cost; no secrets |

SSG / ISR / SSR / RSC / PPR are mixes and orderings of these four — not magic modes.

## Tradeoff triangle

**Freshness × personalization × latency** — cannot max all three for free.

- Fully static → best latency, weak freshness/personalization
- Fully dynamic SSR → fresh + personalized, pays round-trip every request
- **PPR / Cache Components** → static shell + streamed personalized holes (default posture for mixed pages)

## RSC boundary = architecture

Default = Server Component. Push work server-deep. Mark `'use client'` only for interactivity.

Every client boundary:
- Ships JS
- Cannot `await` DB/secrets directly
- Client-bundles imports below it — unless Server content is passed as `children`/props from a Server parent (see tool 10)

Middleware: auth gates, geo rewrites, A/B — **never** DB round-trips. Co-locate server Functions with the database.

Self-host: same Next primitives; you own global ISR, durable cache, Draft Mode security, image/font CDN, failover.

## Five questions (mandatory before code)

1. Same for every visitor, or personalized? → static/cached vs dynamic
2. How stale is acceptable? → `cacheLife` / revalidate / fully dynamic
3. Needs secret, DB credential, or auth check? → server only
4. Needs immediate interaction (click/type/drag)? → Client boundary somewhere
5. Blast radius if wrong/stale? → marketing shrug vs pricing/auth incident

Return answers explicitly before choosing a rendering strategy (tool 03).
