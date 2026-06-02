# Sozu Credit — Documentation

Guides for developers and operators working in this repository. The root [README](../README.md) covers product positioning and quick start; this folder holds **technical and strategic** depth.

---

## Reading order

1. **[architecture-and-platform.md](./architecture-and-platform.md)** — Custody, API layer, schema source of truth.
2. **[credit-marketplace-roadmap.md](./credit-marketplace-roadmap.md)** — Credit marketplace vision; MUJERES 2000 campaign → distribution → open LnB Pool → crowdfund URL → public stats.
3. **[privacy-wallet-roadmap.md](./privacy-wallet-roadmap.md)** — Phased privacy + compliance stack (Phases 1–10); ecosystem map with Sozu Pay and privacy protocol.
4. **[authentication-and-accounts.md](./authentication-and-accounts.md)** — Passkeys, recovery runbooks.
5. **[smart-account-default-payments.md](./smart-account-default-payments.md)** — C-address defaults, send paths, shared tag directory with Sozu Pay.

---

## Index by topic

| Topic | Document |
|--------|----------|
| **Privacy & compliance roadmap (Phases 1–10)** | [privacy-wallet-roadmap.md](./privacy-wallet-roadmap.md) |
| Architecture and platform | [architecture-and-platform.md](./architecture-and-platform.md) |
| Authentication and accounts | [authentication-and-accounts.md](./authentication-and-accounts.md) |
| Smart account payments (C default) | [smart-account-default-payments.md](./smart-account-default-payments.md) |
| Smart account signer migration | [smart-account-signer-migration.md](./smart-account-signer-migration.md) |
| Wallet, Stellar, DeFindex | [wallet-stellar-defindex.md](./wallet-stellar-defindex.md) |
| Blend USDC testnet | [obtain-blend-usdc-testnet.md](./obtain-blend-usdc-testnet.md) |
| Email ledger and Gmail | [email-ledger-and-gmail.md](./email-ledger-and-gmail.md) |
| Payments and settlement | [payments-and-settlement.md](./payments-and-settlement.md) |
| Treasury purchasing power | [treasury-purchasing-power.md](./treasury-purchasing-power.md) |
| Trust, vouches, credit | [community-trust-and-credit.md](./community-trust-and-credit.md) |
| **Credit marketplace & MUJERES 2000 campaigns** | [credit-marketplace-roadmap.md](./credit-marketplace-roadmap.md) |
| Development (PWA, scripts, testing) | [development-guide.md](./development-guide.md) |
| Project history (milestones) | [project-history.md](./project-history.md) |
| **Ten-day dev log (May 23 – Jun 2, 2026)** | [development-log-2026-05-23-to-2026-06-02.md](./development-log-2026-05-23-to-2026-06-02.md) |

### SQL reference

| Script | Purpose |
|--------|---------|
| [supabase-stellar-wallet-signer.sql](./supabase-stellar-wallet-signer.sql) | Factory signer + G fallback schema |
| [supabase-stellar-wallet-oz.sql](./supabase-stellar-wallet-oz.sql) | OpenZeppelin smart account columns |

### Related repositories

| Repo | Documentation |
|------|----------------|
| SozuPay Dashboard (NGO / enterprise) | `docs/` in [SozuPay_dashboard](https://github.com/blessedux/SozuPay_dashboard) |
| Sozu Privacy Protocol (ZK / confidential) | `docs/architecture.md` in `sozu_capital_privacy_protocol` |
