# Sozu Wallet

Passkey-controlled **Smart Accounts** for holding and sending USDC on Stellar. User-facing product promise: Sozu lets you pay and receive **Digital Dollars** with your phone — no ID upload to start, and you control the money.

Architecture decisions: [0001 auth-owned OZ provisioning](./docs/adr/0001-auth-owned-oz-wallet-provisioning.md) · [0002 Passkey-only auth](./docs/adr/0002-passkey-only-auth.md)

## Language

**Digital Dollars**:
User-facing name for money the user pays and receives. Maps to **Token Balance** (USDC) in engineering; never explain the mapping unless the user opens advanced details.
_Avoid_: USDC, stablecoin, crypto, tokens (in user-facing copy)

**No-ID Start**:
Product promise that creating a Passkey and using core pay/receive needs no ID upload. Does not guarantee KYC will never appear for future rails or merchant flows.
_Avoid_: never KYC, no KYC forever, anonymous forever

**Trust Moment**:
A step where the user must decide whether to trust Sozu with control or money — Passkey setup, Setup Incomplete, first Receive/Add money, and first meaningful pay or balance. Custody copy appears here only, in plain “you control…” language.
_Avoid_: self-custody badge, custody footer on every screen, Smart Account / Fee Payer in user copy

**Passkey**:
The user's WebAuthn credential (biometric). Root of non-custodial control; Sozu never holds a seed phrase. In this product version, Passkey is the only user auth path — no PIN login or PIN setup UI.
_Avoid_: password, private key (when meaning the user's secret); backup PIN as auth or recovery story

**Backup PIN** *(retired this version)*:
Former tag+PIN login and settings PIN-set path. This version removes PIN UI/copy and disables PIN auth APIs; `recovery_pin_hash` may remain in the DB unused. Existing users sign in with **Passkey** only. Losing the only Passkey has no in-app recovery until a later recovery initiative (not PIN).
_Avoid_: save your PIN, PIN recovery, continue with PIN (as product features); fake “contact support to recover” copy

**Account Recovery**:
Future capability to regain control after Passkey loss (e.g. second Passkey, social recovery). Not in Narrative UX v1. Product priority after balance visual-feedback (orb), not before.
_Avoid_: Backup PIN as the recovery design; shipping half-recovery messaging with no real path

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
Home state when the user is authenticated but has no Smart Account yet. Shows an explicit Finish setup action; does not silently provision. User-facing copy always separates two beats: Passkey succeeded vs account setup unfinished; primary CTA is finish/retry setup.
_Avoid_: wallet_sync_pending (as a silent background flag), soft failure toast; lost funds / broken wallet / identity-failed copy; PIN backup promises in this state

**Deposit**:
Engineering name for the in-app receive flow that shows the user's Smart Account address / QR so they can receive **Digital Dollars**. User-facing labels are **Receive** (primary) and **Add money** (secondary/CTA). Chain, provider, and network details stay behind explicit disclosure.
_Avoid_: fund wallet, activate account (when meaning receive); USDC / Stellar / Circle in the default Deposit UI

**Merchant Checkout**:
User-facing pay-at-merchant flow. Voice is ordinary payment: merchant, amount/total, confirm, processing, paid / try again. Amounts as plain `$` or **Digital Dollars** — never crypto rails jargon on the default path.
_Avoid_: USDC, Stellar, Circle, wallet address, gas, “credited to your wallet,” Smart Account (in checkout UI)

**App Language**:
User-facing locale for wallet copy. Supported now: English and Spanish. Default with no stored preference follows the browser (`es*` → Spanish, otherwise English); stored settings preference always wins. Portuguese is a later option, not part of the current EN/ES narrative epic.
_Avoid_: hardcoding Spanish for every new user; shipping Portuguese as a blocker for EN/ES work

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

- User-facing copy talks about **Digital Dollars**; engineering talks about **Token Balance** / USDC on a **Smart Account**
- “Wallet” is not the hero product identity; prefer pay/receive **Digital Dollars**. Engineering may still say wallet for session or legacy rows
- **No-ID Start** covers onboarding into core pay/receive only; later identity checks for specific features do not break that promise if copy stays scoped to “to start”
- Custody education is progressive: only at **Trust Moments**, never as ambient product education on every screen
- Auth for this version is **Passkey**-only; **Backup PIN** UI is removed and PIN APIs are disabled; DB hash column may linger unused until a later cleanup
- **Account Recovery** is explicitly deferred; Narrative UX v1 accepts no alternate path if the only Passkey is lost
- A **Passkey** controls exactly one primary **Smart Account** per user (current product model)
- **Wallet Provisioning** deploys an **OZ Smart Account** only; factory fallback is not used for new users — OZ failure → **Setup Incomplete**
- **Wallet Provisioning** is owned by Auth (signup and returning login may each attempt it once at the auth boundary)
- Home on mount only **reads** DB/session + **Token Balance**; it never deploys or registers a Smart Account in the background
- If no Smart Account, Home shows **Setup Incomplete**; the Finish setup CTA may invoke **Wallet Provisioning** once (user-initiated). Copy: passkey ready + setup unfinished — never imply lost money or lost access
- The **Fee Payer** sponsors fees for **Smart Account** transactions; that is compatible with non-custodial so long as it cannot move user USDC without a **Passkey** signature
- Relayer migration is an ops upgrade, not a change to the custody model
- After successful provisioning, Home is normal with $0 **Token Balance** — empty is valid, not an error
- **Deposit** (UI: Receive / Add money) shows receive address/QR; a minimalist in-Deposit CTA may start **Faucet Claim** for testnet dollars (never auto-redirect)
- Default Deposit UI hides chain/provider/network; advanced “Payment details” is opt-in
- **Merchant Checkout** is copy/presentation of payment status only in the UX epic; payment execution mechanics stay unchanged
- **App Language** defaults from the browser unless the user has a stored preference; Portuguese waits on its own issue
- New users never open a classic Horizon trustline; they receive a **Token Balance** on the **Smart Account**
- App DB + on-chain deploy are canonical for the **Smart Account**; the **Contract Indexer** may only quietly hint at drift

## Example dialogue

> **Dev:** "Should Home call ensureSmartWallet if the address is missing?"
> **Domain expert:** "No. Put them in **Setup Incomplete**. Returning login may run **Wallet Provisioning** once at Auth — **OZ Smart Account** only. Home remounts only read address and balance. $0 after setup is fine — funding is Deposit, with an optional testnet faucet link inside that screen."

> **Dev:** "Can onboarding say USDC and explain self-custody on the welcome screen?"
> **Domain expert:** "No. Promise **Digital Dollars**, **No-ID Start**, and control in plain language. Save custody detail for **Trust Moments**. User sees Receive/Add money and boring **Merchant Checkout** — engineering still says Deposit, Token Balance, Smart Account."

## Flagged ambiguities

- "wallet" was used for Passkey session, Smart Account (C…), legacy G address, and the product itself — resolve by naming the concrete concept; user-facing hero identity is pay/receive **Digital Dollars**, not “a crypto wallet.”
- "Deposit" vs "Receive"/"Add money" — engineering keeps **Deposit**; UI uses Receive / Add money only.
- "trustline" is retired for new C users — do not reintroduce as a setup step. Old "activate account" / trustline copy is dead for the C path until removed.
- "factory wallet" remains in code for possible legacy rows; it is not a provision path for new users.
- "non-custodial" does **not** mean "user pays network fees." It means the server cannot spend user funds without Passkey authorization.
- Party-mode GitHub story #24 said “remove PIN backup copy”; product decision is stronger — retire **Backup PIN** UI and disable PIN APIs in Narrative UX v1. Treat #24’s body as superseded by this glossary.
- Roadmap after Narrative UX v1: balance visual feedback via the orb, then **Account Recovery** — not the reverse.
