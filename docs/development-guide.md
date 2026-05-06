# Development guide

Local workflow, PWA assets, testing mindset, and housekeeping.

## Prerequisites

- Node 22+ and **pnpm**
- Supabase project for Postgres/auth
- Turnkey + Stellar credentials as required by features you exercise

## Commands

```bash
pnpm install
pnpm dev
```

If the dev server misbehaves (port lock, stale `.next`):

```bash
pnpm run dev:clean   # runs scripts/dev-clean.sh then dev
```

Other utilities:

```bash
pnpm run auto-deposit           # batch auto-deposit job
pnpm run backfill:ledger-merchant
pnpm exec tsx scripts/backfill-ledger-currency-from-email.ts
```

## PWA icons

1. Add `public/icons/icon-base.png` (1024×1024).
2. Run `./scripts/generate-icons.sh` (see also `public/icons/README.md`).

## Testing

- Prefer exercising flows against a **staging** Supabase project.
- For auth: use dedicated test users; rotate passkeys frequently on shared machines.
- API smoke tests: use authenticated cookies or documented dev headers (`lib/ledger/client-headers.ts` patterns where applicable).

## Performance and UX

- Heavy lists (ledger, transactions) should use pagination and skeletons already established in the App Router pages.
- Avoid shipping massive client bundles for chart-heavy views; reuse shared chart utilities.

## Troubleshooting

- **Payment webhooks**: verify signing secret rotation and idempotency storage.
- **Gmail sync**: check token refresh and cron/route logs (`/api/cron/gmail-sync` when deployed).
