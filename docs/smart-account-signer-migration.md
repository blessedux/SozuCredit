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

## For product / support

- **Stuck USDC on old C** with no working passkey: on-chain recovery requires contract-specific admin (not available on legacy deployments). Options are operational (user proves ownership out-of-band) or accepting stranded funds until a protocol-level recovery exists.
- **Prevention**: registration now stores proper 65-byte passkey pubkeys; deploy uses parsed keys; send uses assertion `rawId` for keyData suffix.
