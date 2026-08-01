# Sozu Wallet

Non-custodial Stellar wallet: passkey-controlled smart accounts for holding and sending USDC.

Architecture decision: [docs/adr/0001-auth-owned-oz-wallet-provisioning.md](./docs/adr/0001-auth-owned-oz-wallet-provisioning.md)

## Language

**Passkey**:
The user's WebAuthn credential (biometric). Root of non-custodial control; Sozu never holds a seed phrase.
_Avoid_: password, private key (when meaning the user's secret)

**Smart Account**:
The on-chain contract address (C…) that holds the user's USDC and authorizes spends via the Passkey.
_Avoid_: wallet address (ambiguous with G), classic account

**Fee Payer**:
Sozu's server G… keypair that pays Soroban network fees. Cannot spend user USDC without a Passkey signature.
_Avoid_: custodial key, master key, wallet secret

**Wallet Provisioning**:
The one-time deploy + DB registration of a Smart Account for a user after Passkey registration.
_Avoid_: wallet sync, ensure wallet, create wallet (when used on Home remount)

**Setup Incomplete**:
Home state when the user is authenticated but has no Smart Account yet. Shows an explicit Finish setup action; does not silently provision.
_Avoid_: wallet_sync_pending (as a silent background flag), soft failure toast

**Deposit**:
The in-app receive flow that shows the user's Smart Account address / QR so they can receive USDC.
_Avoid_: fund wallet, activate account (when meaning receive)

**Faucet Claim**:
Testnet-only flow to claim demo USDC. Reachable via explicit Deposit CTA, QR, or typed URL — never via auto-redirect after signup.
_Avoid_: onboarding fund step, post-auth redirect

**Token Balance**:
USDC held on the Smart Account as a Soroban token balance (e.g. Circle SAC / BlendUSDC). The funded state for C users.
_Avoid_: trustline, Horizon balance (for C users), account activation

**Contract Indexer**:
Optional third-party reverse lookup from Passkey → Smart Account. Best-effort drift hint only; never source of truth and never on the critical path.
_Avoid_: wallet discovery (as required step), create prerequisite

**OZ Smart Account**:
The only Smart Account type provisioned for new users — OpenZeppelin passkey-controlled contract (wallet_type `oz`).
_Avoid_: factory wallet, legacy G wallet (for new users)

## Relationships

- A **Passkey** controls exactly one primary **Smart Account** per user (current product model)
- **Wallet Provisioning** deploys an **OZ Smart Account** only; factory fallback is not used for new users — OZ failure → **Setup Incomplete**
- **Wallet Provisioning** is owned by Auth (signup and returning login may each attempt it once at the auth boundary)
- Home on mount only **reads** DB/session + **Token Balance**; it never deploys or registers a Smart Account in the background
- If no Smart Account, Home shows **Setup Incomplete**; the Finish setup CTA may invoke **Wallet Provisioning** once (user-initiated)
- The **Fee Payer** sponsors fees for **Smart Account** transactions; that is compatible with non-custodial so long as it cannot move user USDC without a **Passkey** signature
- Relayer migration is an ops upgrade, not a change to the custody model
- After successful provisioning, Home is normal with $0 **Token Balance** — empty is valid, not an error
- **Deposit** shows receive address/QR; a minimalist in-Deposit CTA may start **Faucet Claim** for testnet dollars (never auto-redirect)
- New users never open a classic Horizon trustline; they receive a **Token Balance** on the **Smart Account**
- App DB + on-chain deploy are canonical for the **Smart Account**; the **Contract Indexer** may only quietly hint at drift

## Example dialogue

> **Dev:** "Should Home call ensureSmartWallet if the address is missing?"
> **Domain expert:** "No. Put them in **Setup Incomplete**. Returning login may run **Wallet Provisioning** once at Auth — **OZ Smart Account** only. Home remounts only read address and balance. $0 after setup is fine — funding is Deposit, with an optional testnet faucet link inside that screen."

## Flagged ambiguities

- "wallet" was used for Passkey session, Smart Account (C…), and legacy G address — resolve by naming the concrete concept.
- "trustline" is retired for new C users — do not reintroduce as a setup step. Old "activate account" / trustline copy is dead for the C path until removed.
- "factory wallet" remains in code for possible legacy rows; it is not a provision path for new users.
- "non-custodial" does **not** mean "user pays network fees." It means the server cannot spend user funds without Passkey authorization.
