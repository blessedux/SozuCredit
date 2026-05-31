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
| `oz` | `envelopeXdr` + `kit.signAuthEntry` (passkey) → Soroban RPC submit |
| `factory` | Unsigned XDR + ed25519 G signer (passkey-derived) |
| `legacy` | Classic `Operation.payment` |

## Env (align with Sozu Pay testnet)

- `SOROBAN_RPC_URL`
- `SMART_ACCOUNT_FACTORY_ID`
- `SMART_ACCOUNT_GET_ADDRESS_VIEW` (recommended)
- `STELLAR_FUNDER_SECRET`
- `TESTNET_USDC_CONTRACT_ADDRESS`

## Manual send mode

Paste **C** or **G** explicitly. **G** recipients show a legacy notice and use Horizon `Operation.payment`.
