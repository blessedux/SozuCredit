# Smart account signer migration (same C vs new C)

## Short answer

**You cannot “migrate” Supabase or app settings alone and keep spend authority on the same `C…` address.**

Who may move USDC on `CBNHZ…` is defined **on-chain** by the passkey signer baked in at deploy. Our DB only stores metadata.

## When the same account can work (no new C)

1. **Latest app build** (`oz_passkey_local` + assertion `rawId` keyData) — try send again after deploy.
2. **Original passkey / browser** — if the account was created on another device, sign in there once and send.
3. **`add_signer`** — only if the contract exposes admin methods *and* you can still sign **one** transaction as the existing signer to add a new passkey. Contracts without `get_context_rules` usually still cannot be updated from the server without that signature.

## When a “new smart account” appears

`ensureSmartWallet()` / “re-link” may **deploy a new `C…`** via the OZ kit. That updates your profile to a **new** address. It does **not** move USDC from the old `C…`.

| Goal | What works |
|------|------------|
| Keep balance on **same** `CBNHZ…` | Fix signing on that contract (passkey alignment) |
| New `C…` for future use | Re-link / deploy; fund the new `C` separately |
| Move USDC off old `C` | Must **sign a transfer from `CBNHZ…`** (or social recovery if the contract supports it — ours does not) |

There is **no** backend shortcut using `STELLAR_FUNDER_SECRET` to pull user USDC off a passkey smart account without a valid user signature.

## Factory vs OZ passkey

| On-chain type | How to send |
|---------------|-------------|
| Factory (`get_address(G) === C`) | G signer + `authorizeEntry` (ed25519) |
| OZ passkey (WebAuthn `External` in `__check_auth`) | WebAuthn auth entry on `C` |
| OZ without `get_context_rules` | WebAuthn with deploy-matched keyData (`oz_passkey_local`) |

Probe a contract (support):

```http
GET /api/wallet/smart-account/diagnose?contractId=CBNHZ…&signerG=G…
```

## Practical recovery steps for users

1. Hard refresh; retry send on latest production build.
2. Sign out → sign in on the **same browser/device** used at registration.
3. If still failing: check another device where the passkey was created.
4. Do **not** assume re-link moves balance — it may only create a second empty `C…`.
5. Support: run diagnose endpoint; compare Stellar Expert contract type vs `stellar_wallets.wallet_type`.

## OZ WASM `3e51f5b2…` requires AuthPayload + auth digest (2025+)

Testnet deploys use `OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=3e51f5b2…`. That contract **does not** accept the old `smart-account-kit` signature shape (`scvVec` of signer maps only).

Off-chain signing must:

1. Put **`AuthPayload`** on `credentials.signature`: `{ context_rule_ids: [0], signers: { … } }` (rule `0` = Default multisig from deploy).
2. Sign **`auth_digest`**, not the raw Soroban `signature_payload`:
   `auth_digest = sha256(signature_payload || context_rule_ids.to_xdr())`.
3. Use that digest as the WebAuthn `challenge` (base64url).

SozuCredit implements this in `lib/stellar/smartAccounts/ozAuthPayload.ts` and `signSorobanWebAuthnAuth.ts`. Full write-up: [docs/fixes/oz-passkey-soroban-send.md](./fixes/oz-passkey-soroban-send.md).

## rpID mismatch: the most common `__check_auth` cause

**Symptom:** `Error(Auth, InvalidAction)` / `__check_auth` — WebAuthn prompt appears but signing fails.

**Root cause:** The passkey was registered when the app was accessed via one URL (e.g. `https://xyz.ngrok-free.app`) but later payment signing happens at a different origin (e.g. `http://localhost:3001`). WebAuthn ties credentials to `rpID` (the hostname). A credential registered under `xyz.ngrok-free.app` cannot be used from `localhost`.

**Diagnosis:**
```bash
# 1. Check what URL registered the passkey (look for NEXT_PUBLIC_APP_URL in .env.local at time of registration)
grep NEXT_PUBLIC_APP_URL .env.local

# 2. Compare with current browser origin (what you see in the address bar)
# If they differ by hostname → rpID mismatch → wallet is stuck

# 3. Confirm via probe
node scripts/probe-wallet.mjs <C...>
# If probe shows oz_kit but payments fail with __check_auth → signing not the contract type → rpID
```

**Fix for new wallets (Track A):**
1. Set `NEXT_PUBLIC_RP_ID=<canonical-hostname>` in `.env.local`
2. Set `NEXT_PUBLIC_APP_URL=http://<canonical-hostname>:<port>` to match
3. Always access the app from the **same URL** — never mix ngrok and localhost
4. Re-register a passkey (sign out → sign in → wallet setup) at the canonical URL
5. New wallets registered after this fix will work correctly

**Fix for stuck wallets (Track D):**
- The existing C wallet's passkey cannot be used from a different origin
- If the original origin (e.g. ngrok tunnel) is **still accessible**, use it to sign the transfer out
- If the original origin is **gone** (ngrok expired), USDC on that C is stranded until a recovery mechanism is added
- Do **not** use "re-link" to fix a stuck wallet — it deploys a second empty C

**Prevention (implemented):**
- `NEXT_PUBLIC_RP_ID` is now set explicitly in `.env.local`
- Post-deploy `verifyDeployedPubkey` logs a warning if on-chain pubkey doesn't match DB pubkey
- Payment submit returns structured error code `SOROBAN_SIM_AUTH_FAILED` with actionable message

## For product / support

- **Stuck USDC on old C** with no working passkey: on-chain recovery requires contract-specific admin (not available on legacy deployments). Options are operational (user proves ownership out-of-band) or accepting stranded funds until a protocol-level recovery exists.
- **Prevention**: `NEXT_PUBLIC_RP_ID` must always be set. The canonical URL must be communicated to all developers.
- **New code path**: `contractSupportsOzKitSigning` now checks simulation success only (not XDR parse), so `oz_passkey` (kit path) is correctly selected for all OZ contracts. The old `oz_passkey_local` fallback only fires for genuinely incompatible contracts.
