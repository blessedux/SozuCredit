# Tool 07 — TypeScript mastery

Learn by hovering and following inference. Types that disappear at runtime cannot protect boundaries — use Zod there.

## `type` vs `interface`

- Default to `type`
- Prefer `interface extends` for large prop inheritance (faster than `&` at scale)
- Name prop types; avoid forever-inline `{ label: string }` props

## Generics (three patterns)

1. **Functions** — infer `T` at call site
2. **Types** — `DataShape<TData>`
3. **Components** — `Table<TItem>` with typed `renderRow`

Use defaults and constraints (`TError extends { message: string } = Error`).

## High-leverage operators / patterns

**`satisfies`** — validate without widening:

```ts
const routes = {
  home: '/',
  blog: '/blog',
} satisfies Record<string, `/${string}`>
// routes.home is "/" not string
```

**Branded types** — stop stringly ID bugs:

```ts
type UserId = string & { readonly __brand: 'UserId' }
type OrderId = string & { readonly __brand: 'OrderId' }
```

**Discriminated unions** — not optional-everything:

```ts
type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: string }
```

**Type predicates** for narrowing unknowns; compose with Zod.

## Zod at every trust boundary

Forms, third-party APIs, webhooks, query params. Derive types with `z.infer` — never duplicate by hand.

```ts
const UserSchema = z.object({ id: z.string(), email: z.string().email() })
type User = z.infer<typeof UserSchema>
return UserSchema.parse(await res.json())
```

## `any` vs `unknown`

`any` disables checking and propagates. Prefer `unknown` + narrow. Treat remaining `any` as tracked debt.

## Server Actions typing

Type as normal async functions; parse inputs with Zod. Let framework types flow through `useActionState` / `useFormStatus` — don't hand-wire internal globals.

## `tsconfig`

- `strict: true` non-negotiable
- Let Next/`create-next-app` own framework compiler options
