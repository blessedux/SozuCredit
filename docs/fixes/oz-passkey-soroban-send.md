# OZ passkey Soroban send fix (testnet, localhost:3001)

**Status:** Fixed and verified on testnet (e.g. [tx 76983966…](https://stellar.expert/explorer/testnet/tx/76983966d069e8eb480e1d6c48c5e9b5b306bc7f2cd082f569c997b2c99e246e)).

## Symptom

- USDC send from smart account `C…` failed with `Error(Auth, InvalidAction)` / `__check_auth` even on **fresh** accounts at `http://localhost:3001` with correct `NEXT_PUBLIC_RP_ID=localhost`.
- Passkey prompt succeeded; failure appeared on server `simulateBeforeSubmit` or Soroban simulation.

## Root cause

Testnet deploys use **OpenZeppelin smart-account WASM** `OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c`.

That WASM (2025+ OZ accounts) requires:

1. **`AuthPayload` on `credentials.signature`** — ScVal map with:
   - `context_rule_ids`: `Vec<u32>` (one rule id per auth context; **Default deploy → `[0]`**)
   - `signers`: map of External / Delegated signatures  
   Not the legacy `smart-account-kit` shape (`scvVec` wrapping only the signers map).

2. **WebAuthn signs `auth_digest`, not raw `signature_payload`:**
   ```
   signature_payload = sha256(HashIdPreimageSorobanAuthorization XDR)
   auth_digest       = sha256(signature_payload || context_rule_ids.to_xdr())
   challenge         = base64url(auth_digest)
   ```

`smart-account-kit@0.2.10` still signs `base64url(signature_payload)` and omits `context_rule_ids` in the payload — fine for older WASM, **wrong for `3e51f5b2…`**.

## Code changes

| File | Role |
|------|------|
| `lib/stellar/smartAccounts/ozAuthPayload.ts` | `auth_digest`, `buildOzAuthPayloadScVal`, challenge helper |
| `lib/stellar/smartAccounts/signSorobanWebAuthnAuth.ts` | AuthPayload + auth_digest signing; expiration bump |
| `lib/stellar/smartAccounts/signSorobanUsdc.ts` | `cloneFrom` + server `sorobanDataXdr` (skip bad client re-sim) |
| `docs/smart-account-signer-migration.md` | Cross-link + rpID / migration notes |

## Env (localhost)

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_RP_ID=localhost
OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c
OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET=CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH
```

Use **one** origin for register, login, and send (do not mix `:3000` and `:3001` or ngrok).

## Verify

1. Register → wallet setup → fund SAC USDC on `C…`
2. Send to another `C…` or `G…`
3. Console: `[signSorobanUsdc] finalized via cloneFrom + assemble`
4. Server: submit returns `success: true` only after Soroban RPC reports ledger `SUCCESS` (not merely a tx hash)

## False “success” with balance unchanged

If the UI showed success but [Stellar Expert](https://stellar.expert/explorer/testnet/tx/) shows **Failed** and balance is still 20 USDC, the passkey auth likely worked but the tx failed in the ledger (e.g. `operation instructions exceeds amount specified` = Soroban resource budget from pre-sign `sorobanData` too small after signing). Fix: post-sign `simulate` + `assembleTransaction` on the signed envelope before submit, and wait for `getTransaction` `SUCCESS` before showing the confirmation screen.

## References

- [OpenZeppelin Stellar — Signers and Verifiers (auth digest)](https://docs.openzeppelin.com/stellar-contracts/accounts/signers-and-verifiers)
- [OZ stellar-contracts PR #655 — auth digest](https://github.com/OpenZeppelin/stellar-contracts/commit/5958551051a0bba1a007c8dbb44f35fd547edf0f)
