# Architecture and platform

High-level view of how SozuCredit is structured: custody models, backend responsibilities, and where truth lives.

**Strategic direction:** Long-term privacy, compliance, and self-custody phasing is in [privacy-wallet-roadmap.md](./privacy-wallet-roadmap.md) (Phases 1–10). This file describes the **current** platform shape.

## Frontend and API

- **Next.js (App Router)** hosts the PWA UI and route handlers (wallet, auth, ledger, payment rail).
- **Supabase (PostgreSQL + RLS)** stores profiles, passkeys, trust/vouches data, wallet metadata, email-ledger rows, and payment sessions as implemented per migration.

## Custody and wallets

- **Turnkey** backs passkey-based authentication and Stellar wallet provisioning for the product UX described in the main README.
- Users interact with **Stellar** (classic + Soroban paths depending on feature) for balances and DeFi strategies where integrated.

Design discussions around “self-custodial vs assisted” evolution belong here conceptually: prefer enforcing least-privilege API keys, clear separation of **signing** vs **read-only** operations, and documented recovery flows (passkey reset) rather than ad-hoc DB edits.

## Schema source of truth

Shipped incremental DDL lives under **`supabase/migrations/`** (today focused on email ledger + related tables). Older environments may already contain the core wallet/trust schema from historical operational SQL.

**Net-new databases** should import a schema dump from an existing Supabase project (recommended) or recover the deleted numbered `scripts/*.sql` pack from git history before the cleanup commit — do not assume `supabase/migrations/` alone recreates every legacy table.

## Security posture (summary)

- Passkeys/WebAuthn for authentication; no legacy passwords in the happy path.
- Service-role usage limited to trusted server routes and automation; user-facing routes should respect RLS where applicable.
- Payment webhooks must verify partner signatures and enforce idempotency before moving funds.
