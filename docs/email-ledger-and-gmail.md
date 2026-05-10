# Email ledger and Gmail sync

The ledger ingests expense-like transactions from connected Gmail; categorized rows power `/ledger` UI and reporting.

## Google OAuth (Gmail linking)

Set these on the server (for example Vercel project environment variables):

- **`GOOGLE_OAUTH_CLIENT_ID`** or **`GOOGLE_CLIENT_ID`** — OAuth 2.0 client ID from Google Cloud.
- **`GOOGLE_OAUTH_CLIENT_SECRET`** or **`GOOGLE_CLIENT_SECRET`** — required for the token exchange in `/api/gmail/callback`.
- **`GOOGLE_REDIRECT_URI`** (optional) — must exactly match an **Authorized redirect URI** on the same OAuth client. If omitted, the app uses `{request origin}/api/gmail/callback` (from `x-forwarded-proto` / `x-forwarded-host` on Vercel).

The OAuth client must allow the Gmail readonly scope used in code (`gmail.readonly` plus `userinfo.email`). Enable the **Gmail API** on the Google Cloud project for sync.

## Data model (overview)

Defined and evolved in **`supabase/migrations/`** (see `20260504120000_email_ledger.sql` and follow-ups). Core concepts:

- **`gmail_connections`** — OAuth tokens per user.
- **`email_sources`** — Raw Gmail messages pulled during sync.
- **`ledger_transactions`** — Parsed line items (merchant, amount, currency, category, optional `source_email_id`).
- **`ledger_settings`**, **`category_rules`**, **`fx_rates`**, vaults / custom categories — see successive migrations for extensions.

## Application routes (representative)

- `/api/gmail/connect`, `/callback`, `/status`, `/sync`, `/disconnect`
- `/api/ledger/transactions`, `/summary`, `/categories`, `/vaults`, classification helpers

## Operational SQL snippets

### Force re-parse on next sync (destructive)

If you delete Gmail-derived **`ledger_transactions`** without deleting matching **`email_sources`** rows, the sync logic may skip re-insertion depending on dedupe rules. To wipe Gmail-linked ledger rows for a rebuild:

```sql
BEGIN;

DELETE FROM public.ledger_transactions
WHERE source_email_id IS NOT NULL;
-- AND user_id = '...';  -- narrow scope when possible

COMMIT;
```

You lose manual edits on deleted rows (categories, dismissals, overrides). Prefer scoped deletes.

### Backfill scripts

```bash
pnpm exec tsx scripts/backfill-ledger-email-merchant.ts
pnpm exec tsx scripts/backfill-ledger-currency-from-email.ts
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment.

### Merchant categorization rules for agents

See **[`lib/ledger/merchant-categorization-llm-rules.md`](../lib/ledger/merchant-categorization-llm-rules.md)** and **[`.cursor/skills/ledger-merchant-categorization/SKILL.md`](../.cursor/skills/ledger-merchant-categorization/SKILL.md)**.
