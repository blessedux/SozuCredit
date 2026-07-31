# Tool 10 — Scalable architecture patterns

Expensive-to-reverse decisions: composition, repo shape, multi-tenancy, flags×cache.

## Composition > boolean props

```tsx
// bad
<Card title="Plan" isHighlighted hasIcon isCompact showFooter />

// good
<Card>
  <Card.Icon><StarIcon /></Card.Icon>
  <Card.Title>Plan</Card.Title>
  <Card.Footer>Upgrade</Card.Footer>
</Card>
```

Compound components + context; TypeScript can require subcomponents live under parent.

## Server/Client composition trick

Client needs interactivity; Server content stays server — pass as `children` from a Server parent (do not import Server into Client file).

```tsx
'use client'
export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && children}
    </>
  )
}

// page.tsx (Server)
export default async function Page() {
  const data = await getData()
  return (
    <ClientWrapper>
      <ServerRenderedContent data={data} />
    </ClientWrapper>
  )
}
```

## Monorepo / Turborepo

Adopt only with shared code across multiple deployables. Value: task pipelines, remote cache, affected-only CI. Before that threshold = tooling liability.

## Multi-tenant SaaS

- Middleware resolves tenant (subdomain/header) at edge; rewrite internally
- Route groups when shells differ by tier
- **Cache keys/tags must include tenant ID** — #1 multi-tenant bug is serving A’s cache to B
- DB-per-tenant vs shared column is data-layer; long-lived caches still need tenant-aware keys
- `React.cache` per-request is safe; cross-request cache is not without tenant in key

## Feature flags

- Evaluate cheap flag checks before expensive async
- Flag that changes cached output must be part of cache key
- Design flags into caching from day one

## Maintainability test

Could a new engineer add one feature in this area without asking someone? If it needs tribal knowledge, the structure is wrong — fix structure, not the engineer.
