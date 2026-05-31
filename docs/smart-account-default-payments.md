# Smart account (C) default payments

Sozu Credit and Sozu Pay share the same Supabase tag directory (`profiles.username` → `stellar_wallets.public_key`).

## Defaults

| Item | Address |
|------|---------|
| User / org tag directory | **C…** smart account when provisioned |
| Sozu Pay org treasury tag | **C…** (`sorobanC ?? classicG`) |
| Sozu Credit send (non-manual) | Soroban **USDC `transfer`** (testnet Blend USDC contract) |
| Legacy fallback | **G…** classic `Operation.payment` + UI notice |

## New Sozu Credit users

1. Passkey registers in `passkeys` table.
2. Client runs `ensureSmartWallet()` → **OpenZeppelin** deploy (preferred) via `smart-account-kit`.
3. `stellar_wallets`: `public_key` = **C**, `wallet_type` = `oz`, `oz_credential_id` = WebAuthn id.
4. If OZ env missing, falls back to **factory** (`SMART_ACCOUNT_FACTORY_ID`) with `signer_public_key` = **G**.

Run in Supabase:

- `docs/supabase-stellar-wallet-signer.sql`
- `docs/supabase-stellar-wallet-oz.sql`

## Sends

| Sender `wallet_type` | Sign path |
|----------------------|-----------|
| `oz` | Prepared XDR with **G** fee payer + `from`/`to` on C; `kit.signAuthEntry` (passkey) → Soroban submit |
| `factory` | Same Soroban `transfer` (G source, C `from`) + ed25519 G signer (passkey-derived) |
| `legacy` | Classic `Operation.payment` |

**Important:** A **C** address cannot be the Soroban transaction `source` (Stellar SDK decodes it as ed25519 and throws `invalid version byte. expected 48, got 16`). Your **G signer** pays fees; your **C** account authorizes the token transfer.

## Why keep the G signer?

| Role | Address | Purpose |
|------|---------|---------|
| Smart wallet (holds Blend USDC) | **C…** | Soroban contract account — balance, Stellar Expert |
| Passkey signer (fee payer) | **G…** | Pays transaction fees, submits the Soroban tx |
| Recipient (e.g. SozuPay $tag) | **C…** or **G…** | Resolved from shared tag directory |

The audit panel may show USDC on the **G** signer only if you ever held classic Circle USDC there — that is separate from Blend on **C**.

## Env (align with Sozu Pay testnet)

- `SOROBAN_RPC_URL`
- `SMART_ACCOUNT_FACTORY_ID`
- `SMART_ACCOUNT_GET_ADDRESS_VIEW` (recommended)
- `STELLAR_FUNDER_SECRET`
- `TESTNET_USDC_CONTRACT_ADDRESS`

## Manual send mode

Paste **C** or **G** explicitly. **G** recipients show a legacy notice and use Horizon `Operation.payment`.
