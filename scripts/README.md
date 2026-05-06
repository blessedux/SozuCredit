# Scripts

Maintenance utilities referenced from **`package.json`** or operational docs.

## Shell

- **`dev-clean.sh`** — frees ports / stale Next artifacts; used by `pnpm run dev:clean`.
- **`generate-icons.sh`** — generates PWA icons from `public/icons/icon-base.png`.

## TypeScript

- **`auto-deposit-cron.ts`** — batch auto-deposit job (`pnpm run auto-deposit`).
- **`backfill-ledger-email-merchant.ts`** — ledger merchant backfill (`pnpm run backfill:ledger-merchant`).
- **`backfill-ledger-currency-from-email.ts`** — currency backfill (`pnpm exec tsx scripts/backfill-ledger-currency-from-email.ts`).

## Other

- **`dev-friendbot-fund.mjs`** — optional testnet funding helper (run manually when needed).

Database schema changes belong in **`supabase/migrations/`**, not ad-hoc `.sql` files here.
